import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { StripeWebhookHandlerService } from './stripe-webhook-handler.service';
import type { StripeWebhookPayload } from './stripe-webhook.types';

@Injectable()
export class StripeWebhookWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private unsubscribe?: () => void;

  constructor(
    private readonly stripeWebhookHandler: StripeWebhookHandlerService,
    private readonly workerRunner: WorkerRunnerService,
  ) {}

  onModuleInit() {
    if (env.workerName !== 'stripe-webhook') {
      return;
    }

    this.unsubscribe = this.workerRunner.start<StripeWebhookPayload>({
      dlqName: env.stripeWebhookDlqName,
      handler: (message) => this.stripeWebhookHandler.handle(message),
      queueName: env.stripeWebhookQueueName,
      retryPolicy: {
        initialDelayMs: env.queueRetryInitialDelayMs,
        jitterRatio: env.queueRetryJitterRatio,
        maxAttempts: env.queueMaxAttempts,
        maxDelayMs: env.queueRetryMaxDelayMs,
        multiplier: env.queueRetryMultiplier,
      },
      workerName: 'stripe-webhook',
    });
  }

  onApplicationShutdown() {
    this.unsubscribe?.();
  }
}
