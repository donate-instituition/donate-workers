import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ChannelModel, connect, ConsumeMessage } from 'amqplib';

import { env } from '../config/env';
import type { DlqMessage, PublishOptions, QueueMessage, QueuePort } from './queue.types';

@Injectable()
export class RabbitMqQueueService
  implements QueuePort, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMqQueueService.name);
  private channel?: Channel;
  private connection?: ChannelModel;

  async onModuleInit() {
    if (env.queueProvider !== 'rabbitmq') {
      return;
    }

    await this.getChannel();
  }

  async onApplicationShutdown() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  async publish<TPayload>(
    queueName: string,
    message: QueueMessage<TPayload> | DlqMessage<TPayload>,
    options: PublishOptions = {},
  ) {
    const channel = await this.getChannel();
    const delayMs = options.delayMs ?? 0;

    if (delayMs > 0) {
      const retryQueueName = `${queueName}.retry.${delayMs}`;
      await this.assertRetryQueue(queueName, retryQueueName, delayMs);
      channel.publish(
        env.rabbitmqRetryExchange,
        retryQueueName,
        Buffer.from(JSON.stringify(message)),
        {
          contentType: 'application/json',
          persistent: true,
        },
      );
      return;
    }

    await this.assertWorkQueue(queueName);
    channel.publish(
      env.rabbitmqExchange,
      queueName,
      Buffer.from(JSON.stringify(message)),
      {
        contentType: 'application/json',
        persistent: true,
      },
    );
  }

  subscribe<TPayload>(
    queueName: string,
    handler: (message: QueueMessage<TPayload>) => Promise<void>,
  ) {
    let consumerTag: string | undefined;

    void this.getChannel().then(async (channel) => {
      await this.assertWorkQueue(queueName);
      const result = await channel.consume(queueName, async (rawMessage) => {
        if (!rawMessage) {
          return;
        }

        await this.handleMessage(rawMessage, handler);
      });
      consumerTag = result.consumerTag;
    });

    return () => {
      if (consumerTag) {
        void this.channel?.cancel(consumerTag);
      }
    };
  }

  private async handleMessage<TPayload>(
    rawMessage: ConsumeMessage,
    handler: (message: QueueMessage<TPayload>) => Promise<void>,
  ) {
    const channel = await this.getChannel();

    try {
      const message = JSON.parse(
        rawMessage.content.toString('utf8'),
      ) as QueueMessage<TPayload>;
      await handler(message);
      channel.ack(rawMessage);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          errorMessage: error instanceof Error ? error.message : String(error),
          event: 'rabbitmq_message_parse_or_handler_failed',
        }),
      );
      channel.nack(rawMessage, false, false);
    }
  }

  private async getChannel() {
    if (this.channel) {
      return this.channel;
    }

    const connection = await connect(env.rabbitmqUrl);
    const channel = await connection.createChannel();
    this.connection = connection;
    this.channel = channel;
    await channel.prefetch(1);
    await channel.assertExchange(env.rabbitmqExchange, 'direct', {
      durable: true,
    });
    await channel.assertExchange(env.rabbitmqRetryExchange, 'direct', {
      durable: true,
    });
    await channel.assertExchange(env.rabbitmqDlxExchange, 'direct', {
      durable: true,
    });

    return channel;
  }

  private async assertWorkQueue(queueName: string) {
    const channel = await this.getChannel();
    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: env.rabbitmqDlxExchange,
      deadLetterRoutingKey: `${queueName}.dlq`,
    });
    await channel.bindQueue(queueName, env.rabbitmqExchange, queueName);
    await channel.assertQueue(`${queueName}.dlq`, {
      durable: true,
    });
    await channel.bindQueue(
      `${queueName}.dlq`,
      env.rabbitmqDlxExchange,
      `${queueName}.dlq`,
    );
  }

  private async assertRetryQueue(
    queueName: string,
    retryQueueName: string,
    delayMs: number,
  ) {
    const channel = await this.getChannel();
    await channel.assertQueue(retryQueueName, {
      durable: true,
      deadLetterExchange: env.rabbitmqExchange,
      deadLetterRoutingKey: queueName,
      messageTtl: delayMs,
    });
    await channel.bindQueue(
      retryQueueName,
      env.rabbitmqRetryExchange,
      retryQueueName,
    );
  }
}
