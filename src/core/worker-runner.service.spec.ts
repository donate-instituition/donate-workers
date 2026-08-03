import type { IdempotencyStorePort } from '../idempotency/idempotency.types';
import { createQueueMessage } from '../queues/queue-message';
import type { QueuePort } from '../queues/queue.types';
import { WorkerRunnerService } from './worker-runner.service';

function createQueueMock() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(jest.fn()),
  } satisfies QueuePort;
}

function createIdempotencyStoreMock() {
  const completedKeys = new Set<string>();

  return {
    hasCompleted: jest.fn(async (key: string) => completedKeys.has(key)),
    markCompleted: jest.fn(async (key: string) => {
      completedKeys.add(key);
    }),
  } satisfies IdempotencyStorePort;
}

function createRunnerOptions(handler: jest.Mock) {
  return {
    dlqName: 'email.send.dlq',
    handler,
    queueName: 'email.send',
    retryPolicy: {
      initialDelayMs: 10,
      jitterRatio: 0,
      maxAttempts: 3,
      maxDelayMs: 100,
      multiplier: 2,
    },
    workerName: 'email',
  };
}

describe('WorkerRunnerService', () => {
  it('schedules retry before sending a message to DLQ', async () => {
    const queue = createQueueMock();
    const runner = new WorkerRunnerService(
      queue,
      createIdempotencyStoreMock(),
    );
    const handler = jest.fn().mockRejectedValue(new Error('SMTP unavailable'));
    const message = createQueueMessage({
      idempotencyKey: 'email:test',
      payload: { subject: 'Oi', text: 'Mensagem', to: 'ana@example.com' },
      type: 'email.send',
    });

    await runner.process(message, createRunnerOptions(handler));

    expect(queue.publish).toHaveBeenCalledWith(
      'email.send',
      expect.objectContaining({
        attempt: 2,
      }),
      { delayMs: 10 },
    );
  });

  it('sends the message to DLQ when max attempts is reached', async () => {
    const queue = createQueueMock();
    const runner = new WorkerRunnerService(
      queue,
      createIdempotencyStoreMock(),
    );
    const handler = jest.fn().mockRejectedValue(new Error('SMTP unavailable'));
    const message = {
      ...createQueueMessage({
        idempotencyKey: 'email:test',
        payload: { subject: 'Oi', text: 'Mensagem', to: 'ana@example.com' },
        type: 'email.send',
      }),
      attempt: 3,
    };

    await runner.process(message, createRunnerOptions(handler));

    expect(queue.publish).toHaveBeenCalledWith(
      'email.send.dlq',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'SMTP unavailable',
        }),
      }),
    );
  });

  it('skips a duplicate completed message by idempotency key', async () => {
    const queue = createQueueMock();
    const idempotencyStore = createIdempotencyStoreMock();
    const runner = new WorkerRunnerService(queue, idempotencyStore);
    const handler = jest.fn().mockResolvedValue(undefined);
    const message = createQueueMessage({
      idempotencyKey: 'email:test',
      payload: { subject: 'Oi', text: 'Mensagem', to: 'ana@example.com' },
      type: 'email.send',
    });

    await runner.process(message, createRunnerOptions(handler));
    await runner.process(message, createRunnerOptions(handler));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
