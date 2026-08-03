import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  IDEMPOTENCY_STORE,
} from '../idempotency/idempotency.types';
import type { IdempotencyStorePort } from '../idempotency/idempotency.types';
import { createDlqMessage } from '../queues/queue-message';
import { QUEUE_PORT } from '../queues/queue.types';
import type { QueueMessage, QueuePort } from '../queues/queue.types';
import { calculateBackoffDelay, RetryPolicy, shouldRetry } from './retry-policy';

type WorkerRunnerOptions<TPayload> = {
  dlqName: string;
  handler: (message: QueueMessage<TPayload>) => Promise<void>;
  queueName: string;
  retryPolicy: RetryPolicy;
  workerName: string;
};

@Injectable()
export class WorkerRunnerService {
  private readonly logger = new Logger(WorkerRunnerService.name);

  constructor(
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotencyStore: IdempotencyStorePort,
  ) {}

  start<TPayload>(options: WorkerRunnerOptions<TPayload>) {
    const unsubscribe = this.queue.subscribe<TPayload>(
      options.queueName,
      (message) => this.process(message, options),
    );

    this.logger.log(
      JSON.stringify({
        dlqName: options.dlqName,
        event: 'worker_started',
        queueName: options.queueName,
        workerName: options.workerName,
      }),
    );

    return unsubscribe;
  }

  async process<TPayload>(
    message: QueueMessage<TPayload>,
    options: WorkerRunnerOptions<TPayload>,
  ) {
    const metadata = {
      attempt: message.attempt,
      idempotencyKey: message.idempotencyKey,
      messageId: message.id,
      messageType: message.type,
      workerName: options.workerName,
    };

    try {
      if (await this.idempotencyStore.hasCompleted(message.idempotencyKey)) {
        this.logger.log(
          JSON.stringify({
            ...metadata,
            event: 'message_skipped_idempotent_duplicate',
          }),
        );
        return;
      }

      await options.handler(message);
      await this.idempotencyStore.markCompleted(message.idempotencyKey);
      this.logger.log(JSON.stringify({ ...metadata, event: 'message_processed' }));
    } catch (error) {
      await this.handleError(message, error, options, metadata);
    }
  }

  private async handleError<TPayload>(
    message: QueueMessage<TPayload>,
    error: unknown,
    options: WorkerRunnerOptions<TPayload>,
    metadata: Record<string, unknown>,
  ) {
    const errorMetadata = {
      ...metadata,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'WorkerError',
    };

    if (shouldRetry(message.attempt, options.retryPolicy)) {
      const nextAttempt = message.attempt + 1;
      const delayMs = calculateBackoffDelay(message.attempt, options.retryPolicy);

      this.logger.warn(
        JSON.stringify({
          ...errorMetadata,
          delayMs,
          event: 'message_retry_scheduled',
          nextAttempt,
        }),
      );

      await this.queue.publish(
        options.queueName,
        {
          ...message,
          attempt: nextAttempt,
        },
        { delayMs },
      );
      return;
    }

    this.logger.error(
      JSON.stringify({
        ...errorMetadata,
        event: 'message_sent_to_dlq',
      }),
    );
    await this.queue.publish(options.dlqName, createDlqMessage(message, error));
  }
}
