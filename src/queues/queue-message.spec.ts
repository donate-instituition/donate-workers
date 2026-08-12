import { createDlqMessage, createQueueMessage } from './queue-message';

describe('queue-message', () => {
  describe('createQueueMessage', () => {
    it('uses the provided idempotency key when given', () => {
      const message = createQueueMessage({
        idempotencyKey: 'key-1',
        payload: { foo: 'bar' },
        type: 'email.send',
      });

      expect(message.idempotencyKey).toBe('key-1');
      expect(message.attempt).toBe(1);
      expect(message.type).toBe('email.send');
    });

    it('generates a random idempotency key when none is given', () => {
      const message = createQueueMessage({
        payload: {},
        type: 'email.send',
      });

      expect(message.idempotencyKey).toEqual(expect.any(String));
      expect(message.idempotencyKey.length).toBeGreaterThan(0);
    });
  });

  describe('createDlqMessage', () => {
    it('captures message/name/stack when the error is an Error instance', () => {
      const original = createQueueMessage({ payload: {}, type: 'email.send' });
      const error = new Error('boom');

      const dlq = createDlqMessage(original, error);

      expect(dlq.error).toEqual({
        message: 'boom',
        name: 'Error',
        stack: error.stack,
      });
      expect(dlq.deadLetteredAt).toEqual(expect.any(String));
    });

    it('falls back to a stringified message with no stack for non-Error rejections', () => {
      const original = createQueueMessage({ payload: {}, type: 'email.send' });

      const dlq = createDlqMessage(original, 'plain string failure');

      expect(dlq.error).toEqual({
        message: 'plain string failure',
        name: 'WorkerError',
        stack: undefined,
      });
    });
  });
});
