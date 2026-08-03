import { Injectable } from '@nestjs/common';

import type { DlqMessage, PublishOptions, QueueMessage, QueuePort } from './queue.types';

@Injectable()
export class MemoryQueueService implements QueuePort {
  private readonly handlers = new Map<
    string,
    (message: QueueMessage) => Promise<void>
  >();
  private readonly messages = new Map<string, Array<QueueMessage | DlqMessage>>();

  async publish<TPayload>(
    queueName: string,
    message: QueueMessage<TPayload> | DlqMessage<TPayload>,
    options: PublishOptions = {},
  ) {
    const delayMs = options.delayMs ?? 0;
    const queue = this.messages.get(queueName) ?? [];
    this.messages.set(queueName, queue);

    if (delayMs > 0) {
      setTimeout(() => {
        queue.push(message);
        void this.flush(queueName);
      }, delayMs);
      return;
    }

    queue.push(message);
    await this.flush(queueName);
  }

  subscribe<TPayload>(
    queueName: string,
    handler: (message: QueueMessage<TPayload>) => Promise<void>,
  ) {
    this.handlers.set(
      queueName,
      handler as (message: QueueMessage) => Promise<void>,
    );
    void this.flush(queueName);

    return () => {
      this.handlers.delete(queueName);
    };
  }

  getMessages(queueName: string) {
    return [...(this.messages.get(queueName) ?? [])];
  }

  private async flush(queueName: string) {
    const handler = this.handlers.get(queueName);
    const queue = this.messages.get(queueName);

    if (!handler || !queue?.length) {
      return;
    }

    while (queue.length > 0) {
      const message = queue.shift();

      if (!message || 'deadLetteredAt' in message) {
        continue;
      }

      await handler(message);
    }
  }
}
