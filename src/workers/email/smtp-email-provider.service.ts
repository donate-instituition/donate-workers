import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

import { env } from '../../config/env';
import type { EmailProviderPort, NormalizedEmail } from './email.types';

@Injectable()
export class SmtpEmailProviderService
  implements EmailProviderPort, OnModuleInit
{
  private readonly logger = new Logger(SmtpEmailProviderService.name);
  private transporter!: Transporter;

  onModuleInit() {
    this.transporter = createTransport({
      auth: env.smtpUser
        ? {
            pass: env.smtpPass,
            user: env.smtpUser,
          }
        : undefined,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });
  }

  async send(email: NormalizedEmail) {
    const result = await this.transporter.sendMail({
      from: email.from || env.emailFrom,
      html: email.html,
      subject: email.subject,
      text: email.text,
      to: email.to,
    });

    this.logger.log(
      JSON.stringify({
        event: 'email_provider_smtp_send',
        from: email.from || env.emailFrom,
        messageId: result.messageId,
        subject: email.subject,
        to: email.to,
      }),
    );

    return {
      accepted: result.accepted,
      messageId: result.messageId,
      rejected: result.rejected,
    };
  }
}
