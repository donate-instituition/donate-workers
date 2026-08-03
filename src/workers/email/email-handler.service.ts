import { Inject, Injectable } from '@nestjs/common';

import { env } from '../../config/env';
import type { QueueMessage } from '../../queues/queue.types';
import { EMAIL_PROVIDER } from './email.types';
import type { EmailPayload, EmailProviderPort } from './email.types';

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Email job field "${field}" is required`);
  }

  return value.trim();
}

function normalizeRecipients(value: unknown) {
  if (typeof value === 'string') {
    return [assertString(value, 'to')];
  }

  if (Array.isArray(value)) {
    const recipients = value.map((recipient) => assertString(recipient, 'to'));

    if (recipients.length > 0) {
      return recipients;
    }
  }

  throw new Error('Email job field "to" must have at least one recipient');
}

@Injectable()
export class EmailHandlerService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProviderPort,
  ) {}

  async handle(message: QueueMessage<EmailPayload>) {
    const payload = message.payload ?? {};

    await this.emailProvider.send({
      html: typeof payload.html === 'string' ? payload.html : undefined,
      metadata: payload.metadata,
      from: typeof payload.from === 'string' ? payload.from : env.emailFrom,
      subject: assertString(payload.subject, 'subject'),
      text: assertString(payload.text, 'text'),
      to: normalizeRecipients(payload.to),
    });
  }
}
