import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RedisModule } from './cache';
import { env } from './config/env';
import { EmailModule } from './workers/email/email.module';
import { NotificationPushModule } from './workers/notification-push/notification-push.module';
import { ReceiptGenerateModule } from './workers/receipt-generate/receipt-generate.module';
import { StripeWebhookModule } from './workers/stripe-webhook/stripe-webhook.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongodbUri),
    RedisModule,
    EmailModule,
    StripeWebhookModule,
    ReceiptGenerateModule,
    NotificationPushModule,
  ],
})
export class AppModule {}
