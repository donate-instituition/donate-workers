import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';
import type { EmailProviderPort, NormalizedEmail } from './email.types';

type ResendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

@Injectable()
export class ResendEmailProviderService implements EmailProviderPort {
  private readonly logger = new Logger(ResendEmailProviderService.name);

  async send(email: NormalizedEmail) {
    if (!env.resendApiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    }

    const response = await fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: email.from || env.emailFrom,
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: email.to,
      }),
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const result = (await response.json().catch(() => ({}))) as ResendEmailResponse;

    if (!response.ok) {
      throw new Error(
        `Resend email failed with status ${response.status}: ${result.message ?? response.statusText}`,
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'email_provider_resend_send',
        from: email.from || env.emailFrom,
        messageId: result.id,
        subject: email.subject,
        to: email.to,
      }),
    );

    return {
      messageId: result.id,
      provider: 'resend',
    };
  }
}
