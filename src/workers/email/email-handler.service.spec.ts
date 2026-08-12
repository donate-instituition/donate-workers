import { env } from '../../config/env';
import { EmailHandlerService } from './email-handler.service';

function buildMessage(payload: Record<string, unknown>) {
  return {
    attempt: 1,
    id: 'msg-1',
    idempotencyKey: 'key-1',
    payload,
    publishedAt: new Date().toISOString(),
    type: 'email.send',
  };
}

describe('EmailHandlerService', () => {
  it('sends a normalized email with a single string recipient', async () => {
    const emailProvider = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const handler = new EmailHandlerService(emailProvider as any);

    await handler.handle(
      buildMessage({
        html: '<p>Hi</p>',
        metadata: { foo: 'bar' },
        subject: 'Subject',
        text: 'Body text',
        to: 'user@example.com',
      }) as any,
    );

    expect(emailProvider.send).toHaveBeenCalledWith({
      html: '<p>Hi</p>',
      metadata: { foo: 'bar' },
      from: env.emailFrom,
      subject: 'Subject',
      text: 'Body text',
      to: ['user@example.com'],
    });
  });

  it('normalizes an array of recipients and trims whitespace', async () => {
    const emailProvider = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const handler = new EmailHandlerService(emailProvider as any);

    await handler.handle(
      buildMessage({
        subject: '  Subject  ',
        text: '  Body  ',
        to: [' a@example.com ', 'b@example.com'],
      }) as any,
    );

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Subject',
        text: 'Body',
        to: ['a@example.com', 'b@example.com'],
      }),
    );
  });

  it('uses the explicit from address when provided instead of the env default', async () => {
    const emailProvider = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const handler = new EmailHandlerService(emailProvider as any);

    await handler.handle(
      buildMessage({
        from: 'custom@example.com',
        subject: 'Subject',
        text: 'Body',
        to: 'user@example.com',
      }) as any,
    );

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'custom@example.com' }),
    );
  });

  it('defaults html to undefined when not a string', async () => {
    const emailProvider = { send: jest.fn().mockResolvedValue({ ok: true }) };
    const handler = new EmailHandlerService(emailProvider as any);

    await handler.handle(
      buildMessage({ subject: 'Subject', text: 'Body', to: 'user@example.com' }) as any,
    );

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: undefined }),
    );
  });

  it('treats a missing payload as an empty object and throws for the missing subject', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle({
        attempt: 1,
        id: 'msg-2',
        idempotencyKey: 'key-2',
        payload: undefined,
        publishedAt: new Date().toISOString(),
        type: 'email.send',
      } as any),
    ).rejects.toThrow('Email job field "subject" is required');
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('throws when subject is missing or blank', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle(buildMessage({ subject: '   ', text: 'Body', to: 'a@example.com' }) as any),
    ).rejects.toThrow('Email job field "subject" is required');
  });

  it('throws when text is missing', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle(buildMessage({ subject: 'Subject', to: 'a@example.com' }) as any),
    ).rejects.toThrow('Email job field "text" is required');
  });

  it('throws when "to" is an empty array', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle(
        buildMessage({ subject: 'Subject', text: 'Body', to: [] }) as any,
      ),
    ).rejects.toThrow('Email job field "to" must have at least one recipient');
  });

  it('throws when "to" is neither a string nor an array', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle(
        buildMessage({ subject: 'Subject', text: 'Body', to: 42 }) as any,
      ),
    ).rejects.toThrow('Email job field "to" must have at least one recipient');
  });

  it('throws when an item in the "to" array is not a string', async () => {
    const emailProvider = { send: jest.fn() };
    const handler = new EmailHandlerService(emailProvider as any);

    await expect(
      handler.handle(
        buildMessage({ subject: 'Subject', text: 'Body', to: ['a@example.com', 42] }) as any,
      ),
    ).rejects.toThrow('Email job field "to" is required');
  });
});
