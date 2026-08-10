import { createQueueMessage } from './queue-message';
import { RabbitMqQueueService } from './rabbitmq-queue.service';

function createChannelMock() {
  return {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockReturnValue(true),
  };
}

// A DLQ queue is declared once, by its owning work queue's
// assertWorkQueue() call (plain `durable: true`, no dead-letter args of its
// own). Publishing to it must NOT go through assertWorkQueue() again — that
// would try to redeclare it WITH dead-letter args and RabbitMQ rejects a
// changed queue declaration (406 PRECONDITION_FAILED), killing the channel.
// See rabbitmq-queue.service.ts's `publish` for the fix this guards.
describe('RabbitMqQueueService.publish', () => {
  it('publishes to a .dlq queue via the DLX exchange without redeclaring it', async () => {
    const channel = createChannelMock();
    const service = new RabbitMqQueueService();
    (service as any).channel = channel;
    (service as any).connection = {};

    const message = createQueueMessage({
      payload: { foo: 'bar' },
      type: 'receipt.generate',
    });

    await service.publish('receipt.generate.dlq', message);

    expect(channel.assertQueue).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      'donate.dlx',
      'receipt.generate.dlq',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json' }),
    );
  });

  it('declares the work queue before publishing to a normal (non-DLQ) queue', async () => {
    const channel = createChannelMock();
    const service = new RabbitMqQueueService();
    (service as any).channel = channel;
    (service as any).connection = {};

    const message = createQueueMessage({
      payload: { foo: 'bar' },
      type: 'receipt.generate',
    });

    await service.publish('receipt.generate', message);

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'receipt.generate',
      expect.objectContaining({ deadLetterExchange: 'donate.dlx' }),
    );
    expect(channel.publish).toHaveBeenCalledWith(
      'donate.jobs',
      'receipt.generate',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json' }),
    );
  });
});
