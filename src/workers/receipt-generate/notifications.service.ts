import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { env } from '../../config/env';
import type { NotificationData } from '../../domains/notifications/models';
import { NotificationType } from '../../domains/notifications/models';
import {
  Notification,
  NotificationDocument,
} from '../../domains/notifications/schemas/notification.schema';
import { createQueueMessage } from '../../queues/queue-message';
import { QUEUE_PORT } from '../../queues/queue.types';
import type { QueuePort } from '../../queues/queue.types';

type CreateNotificationInput = {
  body: string;
  data?: NotificationData;
  title: string;
  type: NotificationType;
  userId: Types.ObjectId;
};

// Trimmed from donate-server's NotificationsService — only the
// create-once-idempotent path this worker needs (used to avoid a duplicate
// "donation confirmed" push notification if a receipt job retries).
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  async createOnceByDataField(
    field: string,
    value: string,
    input: CreateNotificationInput,
  ) {
    const existing = await this.notificationModel
      .findOne({ [`data.${field}`]: value })
      .exec();

    if (existing) {
      return existing;
    }

    const notification = await this.notificationModel.create(input);
    await this.publishPushJob(notification);

    return notification;
  }

  private async publishPushJob(notification: NotificationDocument) {
    await this.queue.publish(
      env.notificationPushQueueName,
      createQueueMessage({
        type: 'notification.push',
        payload: {
          body: notification.body,
          data: {
            ...(notification.data ?? {}),
            notificationId: notification._id.toString(),
            type: notification.type,
          },
          notificationId: notification._id.toString(),
          title: notification.title,
          userId: notification.userId.toString(),
        },
      }),
    );
  }
}
