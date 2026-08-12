import { env } from '../../config/env';
import { ResendEmailProviderService } from './resend-email-provider.service';

describe('ResendEmailProviderService', () => {
  const originalFetch = global.fetch;
  const originalApiKey = env.resendApiKey;

  afterEach(() => {
    global.fetch = originalFetch;
    env.resendApiKey = originalApiKey;
    jest.restoreAllMocks();
  });

  it('sends emails through Resend API', async () => {
    env.resendApiKey = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ id: 'email-1' }),
      ok: true,
    } as never);
    const provider = new ResendEmailProviderService();

    const result = await provider.send({
      from: 'no-reply@example.com',
      html: '<p>Oi</p>',
      subject: 'Assunto',
      text: 'Oi',
      to: ['ana@example.com'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
    expect(result).toEqual({
      messageId: 'email-1',
      provider: 'resend',
    });
  });

  it('throws when RESEND_API_KEY is not configured', async () => {
    env.resendApiKey = '';
    const provider = new ResendEmailProviderService();

    await expect(
      provider.send({
        from: 'no-reply@example.com',
        subject: 'Assunto',
        text: 'Oi',
        to: ['ana@example.com'],
      }),
    ).rejects.toThrow('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
  });

  it('throws when Resend rejects the request', async () => {
    env.resendApiKey = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ message: 'Invalid from' }),
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    } as never);
    const provider = new ResendEmailProviderService();

    await expect(
      provider.send({
        from: 'no-reply@example.com',
        subject: 'Assunto',
        text: 'Oi',
        to: ['ana@example.com'],
      }),
    ).rejects.toThrow('Resend email failed with status 422: Invalid from');
  });
});
