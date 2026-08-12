import { MemoryQueueService } from './memory-queue.service';
import type { DlqMessage, QueueMessage } from './queue.types';

function createMessage(overrides: Partial<QueueMessage> = {}): QueueMessage {
  return {
    attempt: 1,
    id: 'id-1',
    idempotencyKey: 'key-1',
    payload: { foo: 'bar' },
    publishedAt: new Date().toISOString(),
    type: 'test.type',
    ...overrides,
  };
}

describe('MemoryQueueService', () => {
  it('queues a published message when there is no subscriber yet', async () => {
    const service = new MemoryQueueService();
    const message = createMessage();

    await service.publish('queue-a', message);

    expect(service.getMessages('queue-a')).toEqual([message]);
  });

  it('delivers a queued message to a handler once subscribed', async () => {
    const service = new MemoryQueueService();
    const message = createMessage();
    await service.publish('queue-a', message);
    const handler = jest.fn().mockResolvedValue(undefined);

    service.subscribe('queue-a', handler);
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(message);
    expect(service.getMessages('queue-a')).toEqual([]);
  });

  it('delivers immediately when publishing to an already-subscribed queue', async () => {
    const service = new MemoryQueueService();
    const handler = jest.fn().mockResolvedValue(undefined);
    service.subscribe('queue-a', handler);

    const message = createMessage();
    await service.publish('queue-a', message);

    expect(handler).toHaveBeenCalledWith(message);
  });

  it('delays delivery until after the configured delayMs', async () => {
    jest.useFakeTimers();
    try {
      const service = new MemoryQueueService();
      const handler = jest.fn().mockResolvedValue(undefined);
      service.subscribe('queue-a', handler);

      const message = createMessage();
      await service.publish('queue-a', message, { delayMs: 1000 });

      expect(handler).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(handler).toHaveBeenCalledWith(message);
    } finally {
      jest.useRealTimers();
    }
  });

  it('skips dead-lettered messages instead of passing them to the handler', async () => {
    const service = new MemoryQueueService();
    const handler = jest.fn().mockResolvedValue(undefined);
    const dlqMessage: DlqMessage = {
      ...createMessage(),
      deadLetteredAt: new Date().toISOString(),
      error: { message: 'boom', name: 'Error' },
    };
    await service.publish('queue-a', dlqMessage);

    service.subscribe('queue-a', handler);
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering to a handler after unsubscribe', async () => {
    const service = new MemoryQueueService();
    const handler = jest.fn().mockResolvedValue(undefined);
    const unsubscribe = service.subscribe('queue-a', handler);
    unsubscribe();

    await service.publish('queue-a', createMessage());

    expect(handler).not.toHaveBeenCalled();
    expect(service.getMessages('queue-a')).toHaveLength(1);
  });

  it('getMessages returns an empty array for an unknown queue', () => {
    const service = new MemoryQueueService();

    expect(service.getMessages('unknown')).toEqual([]);
  });
});
