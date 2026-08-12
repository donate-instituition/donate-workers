import { env } from '../../config/env';
import { ConsoleEmailProviderService } from './console-email-provider.service';

describe('ConsoleEmailProviderService', () => {
  it('logs the email and resolves with the console provider metadata', async () => {
    const provider = new ConsoleEmailProviderService();
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation(() => undefined);

    const result = await provider.send({
      from: 'sender@example.com',
      subject: 'Subject',
      text: 'Body',
      to: ['user@example.com'],
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('email_provider_console_send'),
    );
    expect(result.provider).toBe('console');
    expect(typeof result.sentAt).toBe('string');
  });

  it('falls back to the env default from address when email.from is empty', async () => {
    const provider = new ConsoleEmailProviderService();
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation(() => undefined);

    await provider.send({
      from: '',
      subject: 'Subject',
      text: 'Body',
      to: ['user@example.com'],
    });

    const loggedPayload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(loggedPayload.from).toBe(env.emailFrom);
  });
});
