import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppSettingsService } from '../../domains/app-settings/app-settings.service';
import {
  AppSetting,
  AppSettingSchema,
} from '../../domains/app-settings/schemas/app-setting.schema';
import {
  Campaign,
  CampaignSchema,
} from '../../domains/campaigns/schemas/campaign.schema';
import {
  Donation,
  DonationSchema,
} from '../../domains/donations/schemas/donation.schema';
import {
  Institution,
  InstitutionSchema,
} from '../../domains/institutions/schemas/institution.schema';
import {
  Payment,
  PaymentSchema,
} from '../../domains/payments/schemas/payment.schema';
import {
  StripeWebhookEvent,
  StripeWebhookEventSchema,
} from '../../domains/payments/schemas/stripe-webhook-event.schema';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { QueueModule } from '../../queues/queue.module';
import { StripeWebhookHandlerService } from './stripe-webhook-handler.service';
import { StripeWebhookWorkerService } from './stripe-webhook-worker.service';

@Module({
  imports: [
    IdempotencyModule,
    QueueModule,
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: StripeWebhookEvent.name, schema: StripeWebhookEventSchema },
    ]),
  ],
  providers: [
    WorkerRunnerService,
    AppSettingsService,
    StripeWebhookHandlerService,
    StripeWebhookWorkerService,
  ],
})
export class StripeWebhookModule {}
