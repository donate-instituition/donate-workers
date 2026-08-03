export type QueueMessage<TPayload = unknown> = {
  attempt: number;
  id: string;
  idempotencyKey: string;
  payload: TPayload;
  publishedAt: string;
  type: string;
};

export type DlqMessage<TPayload = unknown> = QueueMessage<TPayload> & {
  deadLetteredAt: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
};

export type PublishOptions = {
  delayMs?: number;
};

export type QueuePort = {
  publish<TPayload>(
    queueName: string,
    message: QueueMessage<TPayload> | DlqMessage<TPayload>,
    options?: PublishOptions,
  ): Promise<void>;
  subscribe<TPayload>(
    queueName: string,
    handler: (message: QueueMessage<TPayload>) => Promise<void>,
  ): () => void;
};

export const QUEUE_PORT = Symbol('QUEUE_PORT');
