import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../domains/users/schemas/user.schema';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { QueueModule } from '../../queues/queue.module';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationPushHandlerService } from './notification-push-handler.service';
import { NotificationPushWorkerService } from './notification-push-worker.service';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [
    IdempotencyModule,
    QueueModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    WorkerRunnerService,
    FirebaseAdminService,
    PushNotificationsService,
    NotificationPushHandlerService,
    NotificationPushWorkerService,
  ],
})
export class NotificationPushModule {}
