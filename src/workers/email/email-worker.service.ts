import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { env, isWorkerEnabled } from '../../config/env';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { EmailHandlerService } from './email-handler.service';
import type { EmailPayload } from './email.types';

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnApplicationShutdown {
  private unsubscribe?: () => void;

  constructor(
    private readonly emailHandler: EmailHandlerService,
    private readonly workerRunner: WorkerRunnerService,
  ) {}

  onModuleInit() {
    if (!isWorkerEnabled('email')) {
      return;
    }

    this.unsubscribe = this.workerRunner.start<EmailPayload>({
      dlqName: env.emailDlqName,
      handler: (message) => this.emailHandler.handle(message),
      queueName: env.emailQueueName,
      retryPolicy: {
        initialDelayMs: env.emailRetryInitialDelayMs,
        jitterRatio: env.emailRetryJitterRatio,
        maxAttempts: env.emailMaxAttempts,
        maxDelayMs: env.emailRetryMaxDelayMs,
        multiplier: env.emailRetryMultiplier,
      },
      workerName: 'email',
    });
  }

  onApplicationShutdown() {
    this.unsubscribe?.();
  }
}
