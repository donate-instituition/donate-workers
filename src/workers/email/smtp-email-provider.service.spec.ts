import { createTransport } from 'nodemailer';

import { env } from '../../config/env';
import { SmtpEmailProviderService } from './smtp-email-provider.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpEmailProviderService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a transporter without auth when no smtpUser is configured', () => {
    const sendMail = jest.fn();
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProviderService();

    provider.onModuleInit();

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined, host: 'localhost' }),
    );
  });

  it('sends mail through the transporter and returns accepted/rejected/messageId', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: ['user@example.com'],
      messageId: 'msg-123',
      rejected: [],
    });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProviderService();
    provider.onModuleInit();
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation(() => undefined);

    const result = await provider.send({
      from: 'sender@example.com',
      html: '<p>Hi</p>',
      subject: 'Subject',
      text: 'Body',
      to: ['user@example.com'],
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      html: '<p>Hi</p>',
      subject: 'Subject',
      text: 'Body',
      to: ['user@example.com'],
    });
    expect(result).toEqual({
      accepted: ['user@example.com'],
      messageId: 'msg-123',
      rejected: [],
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('email_provider_smtp_send'));
  });

  it('falls back to the env default from address when email.from is empty', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: [],
      messageId: 'msg-456',
      rejected: ['user@example.com'],
    });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProviderService();
    provider.onModuleInit();
    jest.spyOn((provider as any).logger, 'log').mockImplementation(() => undefined);

    await provider.send({
      from: '',
      subject: 'Subject',
      text: 'Body',
      to: ['user@example.com'],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: env.emailFrom }),
    );
  });
});
