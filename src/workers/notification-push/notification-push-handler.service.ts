import { Injectable } from '@nestjs/common';

import type { QueueMessage } from '../../queues/queue.types';
import type { NotificationPushPayload } from './notification-push.types';
import { PushNotificationsService } from './push-notifications.service';

@Injectable()
export class NotificationPushHandlerService {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  async handle(message: QueueMessage<NotificationPushPayload>) {
    await this.pushNotificationsService.sendToUser(message.payload);
  }
}
