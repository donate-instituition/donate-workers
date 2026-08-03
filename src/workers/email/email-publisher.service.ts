import { Inject, Injectable } from '@nestjs/common';

import { env } from '../../config/env';
import { createQueueMessage } from '../../queues/queue-message';
import { QUEUE_PORT } from '../../queues/queue.types';
import type { QueuePort } from '../../queues/queue.types';
import type { EmailPayload } from './email.types';

@Injectable()
export class EmailPublisherService {
  constructor(@Inject(QUEUE_PORT) private readonly queue: QueuePort) {}

  createMessage(payload: EmailPayload, options: { idempotencyKey?: string } = {}) {
    return createQueueMessage({
      idempotencyKey: options.idempotencyKey,
      payload,
      type: 'email.send',
    });
  }

  async publish(payload: EmailPayload, options: { idempotencyKey?: string } = {}) {
    const message = this.createMessage(payload, options);
    await this.queue.publish(env.emailQueueName, message);
    return message;
  }
}
