import { randomUUID } from 'crypto';

import type { DlqMessage, QueueMessage } from './queue.types';

export function createQueueMessage<TPayload>({
  idempotencyKey,
  payload,
  type,
}: {
  idempotencyKey?: string;
  payload: TPayload;
  type: string;
}): QueueMessage<TPayload> {
  return {
    attempt: 1,
    id: randomUUID(),
    idempotencyKey: idempotencyKey || randomUUID(),
    payload,
    publishedAt: new Date().toISOString(),
    type,
  };
}

export function createDlqMessage<TPayload>(
  message: QueueMessage<TPayload>,
  error: unknown,
): DlqMessage<TPayload> {
  return {
    ...message,
    deadLetteredAt: new Date().toISOString(),
    error: {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'WorkerError',
      stack: error instanceof Error ? error.stack : undefined,
    },
  };
}
