import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';
import type { EmailProviderPort, NormalizedEmail } from './email.types';

@Injectable()
export class ConsoleEmailProviderService implements EmailProviderPort {
  private readonly logger = new Logger(ConsoleEmailProviderService.name);

  async send(email: NormalizedEmail) {
    this.logger.log(
      JSON.stringify({
        event: 'email_provider_console_send',
        from: email.from || env.emailFrom,
        subject: email.subject,
        to: email.to,
      }),
    );

    return {
      provider: 'console',
      sentAt: new Date().toISOString(),
    };
  }
}
