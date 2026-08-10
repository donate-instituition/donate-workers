import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AppSetting,
  AppSettingSchema,
} from '../../domains/app-settings/schemas/app-setting.schema';
import { AppSettingsService } from '../../domains/app-settings/app-settings.service';
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
  Notification,
  NotificationSchema,
} from '../../domains/notifications/schemas/notification.schema';
import {
  Payment,
  PaymentSchema,
} from '../../domains/payments/schemas/payment.schema';
import {
  TaxReceipt,
  TaxReceiptSchema,
} from '../../domains/tax-receipts/schemas/tax-receipt.schema';
import { User, UserSchema } from '../../domains/users/schemas/user.schema';
import { WorkerRunnerService } from '../../core/worker-runner.service';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { QueueModule } from '../../queues/queue.module';
import { StorageModule } from '../../storage/storage.module';
import { EmailJobsService } from './email-jobs.service';
import { NotificationsService } from './notifications.service';
import { ReceiptGenerateHandlerService } from './receipt-generate-handler.service';
import { ReceiptGenerateWorkerService } from './receipt-generate-worker.service';
import { TaxReceiptsService } from './tax-receipts.service';

@Module({
  imports: [
    IdempotencyModule,
    QueueModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: TaxReceipt.name, schema: TaxReceiptSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    WorkerRunnerService,
    AppSettingsService,
    EmailJobsService,
    NotificationsService,
    TaxReceiptsService,
    ReceiptGenerateHandlerService,
    ReceiptGenerateWorkerService,
  ],
})
export class ReceiptGenerateModule {}
