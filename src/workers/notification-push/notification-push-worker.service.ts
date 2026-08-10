import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { NotificationPushHandlerService } from './notification-push-handler.service';
import type { NotificationPushPayload } from './notification-push.types';

@Injectable()
export class NotificationPushWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private unsubscribe?: () => void;

  constructor(
    private readonly notificationPushHandler: NotificationPushHandlerService,
    private readonly workerRunner: WorkerRunnerService,
  ) {}

  onModuleInit() {
    if (env.workerName !== 'notification-push') {
      return;
    }

    this.unsubscribe = this.workerRunner.start<NotificationPushPayload>({
      dlqName: env.notificationPushDlqName,
      handler: (message) => this.notificationPushHandler.handle(message),
      queueName: env.notificationPushQueueName,
      retryPolicy: {
        initialDelayMs: env.queueRetryInitialDelayMs,
        jitterRatio: env.queueRetryJitterRatio,
        maxAttempts: env.queueMaxAttempts,
        maxDelayMs: env.queueRetryMaxDelayMs,
        multiplier: env.queueRetryMultiplier,
      },
      workerName: 'notification-push',
    });
  }

  onApplicationShutdown() {
    this.unsubscribe?.();
  }
}
