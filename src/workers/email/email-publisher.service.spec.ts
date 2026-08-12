import { EmailPublisherService } from './email-publisher.service';

describe('EmailPublisherService', () => {
  describe('createMessage', () => {
    it('builds an email.send queue message from the payload without publishing', () => {
      const queue = { publish: jest.fn() };
      const service = new EmailPublisherService(queue as any);

      const message = service.createMessage({
        subject: 'Subject',
        text: 'Body',
        to: 'user@example.com',
      });

      expect(message.type).toBe('email.send');
      expect(message.payload).toEqual({
        subject: 'Subject',
        text: 'Body',
        to: 'user@example.com',
      });
      expect(queue.publish).not.toHaveBeenCalled();
    });

    it('uses the provided idempotencyKey when given', () => {
      const queue = { publish: jest.fn() };
      const service = new EmailPublisherService(queue as any);

      const message = service.createMessage(
        { subject: 'S', text: 'T', to: 'a@example.com' },
        { idempotencyKey: 'custom-key' },
      );

      expect(message.idempotencyKey).toBe('custom-key');
    });

    it('generates a random idempotencyKey when none is given', () => {
      const queue = { publish: jest.fn() };
      const service = new EmailPublisherService(queue as any);

      const message = service.createMessage({ subject: 'S', text: 'T', to: 'a@example.com' });

      expect(typeof message.idempotencyKey).toBe('string');
      expect(message.idempotencyKey.length).toBeGreaterThan(0);
    });
  });

  describe('publish', () => {
    it('publishes the created message to the email queue and returns it', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const service = new EmailPublisherService(queue as any);

      const result = await service.publish({
        subject: 'Subject',
        text: 'Body',
        to: 'user@example.com',
      });

      expect(queue.publish).toHaveBeenCalledWith(
        'email.send',
        expect.objectContaining({
          type: 'email.send',
          payload: { subject: 'Subject', text: 'Body', to: 'user@example.com' },
        }),
      );
      expect(result.type).toBe('email.send');
    });
  });
});
