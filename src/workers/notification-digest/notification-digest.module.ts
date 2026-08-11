import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

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
import { User, UserSchema } from '../../domains/users/schemas/user.schema';
import { QueueModule } from '../../queues/queue.module';
import { EmailJobsService } from '../receipt-generate/email-jobs.service';
import { NotificationDigestWorkerService } from './notification-digest-worker.service';
import { WeeklyDigestService } from './weekly-digest.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    AppSettingsService,
    EmailJobsService,
    WeeklyDigestService,
    NotificationDigestWorkerService,
  ],
})
export class NotificationDigestModule {}
