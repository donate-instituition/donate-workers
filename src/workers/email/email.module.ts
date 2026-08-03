import { Module } from '@nestjs/common';

import { WorkerRunnerService } from '../../core/worker-runner.service';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { QueueModule } from '../../queues/queue.module';
import { ConsoleEmailProviderService } from './console-email-provider.service';
import { EmailHandlerService } from './email-handler.service';
import { EmailPublisherService } from './email-publisher.service';
import { EMAIL_PROVIDER } from './email.types';
import { EmailWorkerService } from './email-worker.service';
import { ResendEmailProviderService } from './resend-email-provider.service';
import { SmtpEmailProviderService } from './smtp-email-provider.service';
import { env } from '../../config/env';

@Module({
  imports: [IdempotencyModule, QueueModule],
  providers: [
    WorkerRunnerService,
    ConsoleEmailProviderService,
    ResendEmailProviderService,
    SmtpEmailProviderService,
    EmailHandlerService,
    EmailPublisherService,
    EmailWorkerService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        consoleEmailProvider: ConsoleEmailProviderService,
        resendEmailProvider: ResendEmailProviderService,
        smtpEmailProvider: SmtpEmailProviderService,
      ) => {
        if (env.emailProvider === 'resend') {
          return resendEmailProvider;
        }

        if (env.emailProvider === 'smtp') {
          return smtpEmailProvider;
        }

        if (env.emailProvider === 'console') {
          return consoleEmailProvider;
        }

        throw new Error(`Unsupported EMAIL_PROVIDER: ${env.emailProvider}`);
      },
      inject: [
        ConsoleEmailProviderService,
        ResendEmailProviderService,
        SmtpEmailProviderService,
      ],
    },
  ],
  exports: [EmailPublisherService],
})
export class EmailModule {}
