import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { ReceiptGenerateHandlerService } from './receipt-generate-handler.service';
import type { ReceiptGeneratePayload } from './receipt-generate.types';

@Injectable()
export class ReceiptGenerateWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private unsubscribe?: () => void;

  constructor(
    private readonly receiptGenerateHandler: ReceiptGenerateHandlerService,
    private readonly workerRunner: WorkerRunnerService,
  ) {}

  onModuleInit() {
    if (env.workerName !== 'receipt-generate') {
      return;
    }

    this.unsubscribe = this.workerRunner.start<ReceiptGeneratePayload>({
      dlqName: env.receiptGenerateDlqName,
      handler: (message) => this.receiptGenerateHandler.handle(message),
      queueName: env.receiptGenerateQueueName,
      retryPolicy: {
        initialDelayMs: env.queueRetryInitialDelayMs,
        jitterRatio: env.queueRetryJitterRatio,
        maxAttempts: env.queueMaxAttempts,
        maxDelayMs: env.queueRetryMaxDelayMs,
        multiplier: env.queueRetryMultiplier,
      },
      workerName: 'receipt-generate',
    });
  }

  onApplicationShutdown() {
    this.unsubscribe?.();
  }
}
