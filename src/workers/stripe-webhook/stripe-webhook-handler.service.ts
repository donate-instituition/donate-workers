import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { campaignCacheKey, institutionCacheKey, RedisService } from '../../cache';
import { env } from '../../config/env';
import { AppSettingKey } from '../../domains/app-settings/app-settings.defaults';
import { AppSettingsService } from '../../domains/app-settings/app-settings.service';
import {
  Campaign,
  CampaignDocument,
} from '../../domains/campaigns/schemas/campaign.schema';
import { DonationStatus } from '../../domains/donations/models';
import {
  DonationDeliveryMode,
  DonationType,
  DonationVisibility,
} from '../../domains/donations/models';
import {
  Donation,
  DonationDocument,
} from '../../domains/donations/schemas/donation.schema';
import { FollowTargetType } from '../../domains/follows/models';
import { Follow, FollowDocument } from '../../domains/follows/schemas/follow.schema';
import {
  Institution,
  InstitutionDocument,
} from '../../domains/institutions/schemas/institution.schema';
import { NotificationType } from '../../domains/notifications/models';
import { PaymentStatus } from '../../domains/payments/models';
import { PaymentGateway, PaymentMethod } from '../../domains/payments/models';
import {
  Payment,
  PaymentDocument,
} from '../../domains/payments/schemas/payment.schema';
import {
  StripeWebhookEvent,
  StripeWebhookEventDocument,
  StripeWebhookEventStatus,
} from '../../domains/payments/schemas/stripe-webhook-event.schema';
import { createQueueMessage } from '../../queues/queue-message';
import { QUEUE_PORT } from '../../queues/queue.types';
import type { QueuePort } from '../../queues/queue.types';
import type { QueueMessage } from '../../queues/queue.types';
import { NotificationsService } from '../receipt-generate/notifications.service';
import type { StripeWebhookPayload } from './stripe-webhook.types';

// Ported from donate-server's StripeWebhookProcessorService — same Mongo
// reads/writes and cache-invalidation calls, but the RabbitMQ consumption
// (ack/nack, retry, DLQ) is now owned by WorkerRunnerService instead of a
// raw amqplib consumer.
@Injectable()
export class StripeWebhookHandlerService {
  private readonly logger = new Logger(StripeWebhookHandlerService.name);
  private stripeClient?: Stripe;

  constructor(
    @InjectModel(StripeWebhookEvent.name)
    private readonly stripeWebhookEventModel: Model<StripeWebhookEventDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    private readonly appSettingsService: AppSettingsService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  async handle(message: QueueMessage<StripeWebhookPayload>) {
    await this.processQueuedEvent(message.payload.eventId);
  }

  async processQueuedEvent(eventId: string) {
    const eventRecord = await this.stripeWebhookEventModel
      .findOneAndUpdate(
        {
          eventId,
          status: { $ne: StripeWebhookEventStatus.PROCESSED },
        },
        {
          $set: {
            status: StripeWebhookEventStatus.PROCESSING,
            lastError: undefined,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!eventRecord) {
      this.logger.debug(
        `Stripe webhook event ${eventId} already processed or not found.`,
      );
      return;
    }

    try {
      const event = eventRecord.payload as unknown as Stripe.Event;
      this.logger.log(
        JSON.stringify({
          event: 'stripe_webhook_processing_started',
          eventId: event.id,
          type: event.type,
        }),
      );

      if (event.type === 'payment_intent.succeeded') {
        await this.handlePaymentIntentSucceeded(event.data.object);
      }

      if (
        event.type === 'payment_intent.payment_failed' ||
        event.type === 'payment_intent.canceled'
      ) {
        await this.handlePaymentIntentTerminalFailure(event.data.object);
      }

      if (event.type === 'invoice.payment_succeeded') {
        await this.handleInvoicePaymentSucceeded(event.data.object);
      }

      if (event.type === 'account.updated') {
        await this.handleAccountUpdated(event.data.object);
      }

      await this.stripeWebhookEventModel
        .findByIdAndUpdate(eventRecord._id, {
          $set: {
            status: StripeWebhookEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        })
        .exec();
      this.logger.log(
        JSON.stringify({
          event: 'stripe_webhook_processed',
          eventId: event.id,
          type: event.type,
        }),
      );
    } catch (error) {
      await this.stripeWebhookEventModel
        .findByIdAndUpdate(eventRecord._id, {
          $set: {
            status: StripeWebhookEventStatus.FAILED,
            lastError: error instanceof Error ? error.message : String(error),
          },
        })
        .exec();
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntent.id })
      .exec();

    if (!payment) {
      this.logger.warn(
        JSON.stringify({
          event: 'stripe_payment_intent_without_local_payment',
          paymentIntentId: paymentIntent.id,
        }),
      );
      return;
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.debug(
        JSON.stringify({
          event: 'stripe_payment_intent_already_paid',
          paymentId: payment._id.toString(),
          paymentIntentId: paymentIntent.id,
        }),
      );
      return;
    }

    const donation = await this.donationModel
      .findById(payment.donationId)
      .exec();

    if (!donation) {
      throw new Error(`Donation ${payment.donationId.toString()} not found`);
    }

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      latestCharge: paymentIntent.latest_charge,
      status: paymentIntent.status,
    };
    await payment.save();

    donation.status = DonationStatus.PAID;
    await donation.save();

    if (donation.campaignId) {
      await this.incrementCampaignProgress(
        donation.campaignId,
        payment.amount / 100,
      );
      await Promise.all([
        this.redisService.del(campaignCacheKey(donation.campaignId.toString())),
        this.redisService.increment('cache:version:campaigns'),
      ]).catch(() => undefined);
    }

    this.logger.log(
      JSON.stringify({
        event: 'stripe_payment_intent_marked_paid',
        donationId: donation._id.toString(),
        paymentId: payment._id.toString(),
        paymentIntentId: paymentIntent.id,
      }),
    );

    await this.queueReceiptGeneration(
      donation._id.toString(),
      payment._id.toString(),
    );
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    const requirementsCurrentlyDue =
      account.requirements?.currently_due?.filter(Boolean) ?? [];
    const ready = Boolean(account.charges_enabled && account.details_submitted);
    const matchFilter = {
      $or: [
        { stripeConnectAccountId: account.id },
        { 'stripeConnect.accountId': account.id },
      ],
    };
    const affectedInstitutionIds = await this.institutionModel
      .find(matchFilter)
      .select('_id')
      .lean()
      .exec();

    await this.institutionModel
      .updateMany(matchFilter, {
        $set: {
          stripeConnectAccountId: account.id,
          stripeConnect: {
            accountId: account.id,
            chargesEnabled: Boolean(account.charges_enabled),
            country: account.country,
            defaultCurrency: account.default_currency,
            detailsSubmitted: Boolean(account.details_submitted),
            exists: true,
            livemode: env.stripeSecretKey.startsWith('sk_live_'),
            payoutsEnabled: Boolean(account.payouts_enabled),
            ready,
            requirementsCurrentlyDue,
            requirementsDisabledReason: account.requirements?.disabled_reason,
            verifiedAt: new Date(),
          },
        },
      })
      .exec();

    await Promise.all(
      affectedInstitutionIds.map((institution) =>
        this.redisService.del(institutionCacheKey(institution._id.toString())),
      ),
    ).catch(() => undefined);
  }

  private async handlePaymentIntentTerminalFailure(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntent.id })
      .exec();

    if (!payment || payment.status === PaymentStatus.PAID) {
      return;
    }

    const donation = await this.donationModel
      .findById(payment.donationId)
      .exec();
    const nextStatus =
      paymentIntent.status === 'canceled'
        ? PaymentStatus.CANCELED
        : PaymentStatus.FAILED;

    payment.status = nextStatus;
    payment.gatewayPayload = {
      ...(payment.gatewayPayload ?? {}),
      status: paymentIntent.status,
    };
    await payment.save();

    if (donation) {
      donation.status =
        nextStatus === PaymentStatus.CANCELED
          ? DonationStatus.CANCELED
          : DonationStatus.FAILED;
      await donation.save();
    }
  }

  private getStripeClient() {
    if (!env.stripeSecretKey) {
      throw new Error('Stripe is not configured.');
    }

    this.stripeClient ??= new Stripe(env.stripeSecretKey, {
      appInfo: {
        name: env.serviceName,
        version: env.serviceVersion,
      },
    });

    return this.stripeClient;
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const invoiceWithPaymentIntent = invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
      subscription?: string | Stripe.Subscription | null;
    };
    const paymentIntentId =
      typeof invoiceWithPaymentIntent.payment_intent === 'string'
        ? invoiceWithPaymentIntent.payment_intent
        : invoiceWithPaymentIntent.payment_intent?.id;

    if (!paymentIntentId) {
      return;
    }

    const existingPayment = await this.paymentModel
      .findOne({ gatewayTransactionId: paymentIntentId })
      .exec();

    if (existingPayment) {
      return;
    }

    const subscriptionId =
      typeof invoiceWithPaymentIntent.subscription === 'string'
        ? invoiceWithPaymentIntent.subscription
        : invoiceWithPaymentIntent.subscription?.id;

    if (!subscriptionId) {
      return;
    }

    const subscription =
      await this.getStripeClient().subscriptions.retrieve(subscriptionId);
    const campaignId = subscription.metadata?.campaignId;
    const donorUserId = subscription.metadata?.donorUserId;
    const institutionId = subscription.metadata?.institutionId;

    if (!campaignId || !donorUserId || !institutionId) {
      throw new Error(
        `Subscription ${subscriptionId} is missing donation metadata`,
      );
    }

    const amountCents = invoice.amount_paid ?? invoice.amount_due ?? 0;
    const serviceFeeBps = await this.appSettingsService.getNumber(
      AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      env.stripeServiceFeeBps,
    );
    const serviceFeeAmount =
      serviceFeeBps > 0 && serviceFeeBps < 10_000
        ? Math.floor((amountCents * serviceFeeBps) / 10_000)
        : 0;
    const donation = await this.donationModel.create({
      campaignId,
      deliveryMode: DonationDeliveryMode.INSTANT_ONLINE,
      donorUserId,
      institutionId,
      moneyDonation: {
        amount: amountCents / 100,
        currency: (invoice.currency ?? env.stripeCurrency).toUpperCase(),
      },
      receiptEligible: true,
      status: DonationStatus.PAID,
      type: DonationType.MONEY,
      visibility: DonationVisibility.PUBLIC,
    });
    const payment = await this.paymentModel.create({
      amount: amountCents,
      currency: (invoice.currency ?? env.stripeCurrency).toUpperCase(),
      donationId: donation._id,
      donorUserId,
      gateway: PaymentGateway.STRIPE,
      gatewayPayload: {
        donationKind: 'monthly',
        invoiceId: invoice.id,
        paymentIntentId,
        serviceFeeAmount,
        serviceFeeBps,
        status: 'succeeded',
        subscriptionId,
      },
      gatewayTransactionId: paymentIntentId,
      institutionId,
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PAID,
    });

    await this.incrementCampaignProgress(campaignId, amountCents / 100);

    await this.queueReceiptGeneration(
      donation._id.toString(),
      payment._id.toString(),
    );
  }

  private async incrementCampaignProgress(
    campaignId: Types.ObjectId | string,
    amount: number,
  ) {
    const updatedCampaign = await this.campaignModel
      .findByIdAndUpdate(
        campaignId,
        {
          $inc: {
            'progress.moneyRaised': amount,
            'stats.donationsCount': 1,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (updatedCampaign) {
      await this.notifyCampaignGoalReachedIfCrossed(updatedCampaign, amount);
    }

    return updatedCampaign;
  }

  private async notifyCampaignGoalReachedIfCrossed(
    campaign: CampaignDocument,
    incrementAmount: number,
  ) {
    const target = campaign.goal?.moneyTarget ?? 0;
    const after = campaign.progress?.moneyRaised ?? 0;
    const before = after - incrementAmount;

    if (target <= 0 || before >= target || after < target) {
      return;
    }

    const [campaignFollows, institutionFollows] = await Promise.all([
      this.followModel
        .find({ targetType: FollowTargetType.CAMPAIGN, targetId: campaign._id })
        .select('followerUserId')
        .lean()
        .exec(),
      this.followModel
        .find({
          targetType: FollowTargetType.INSTITUTION,
          targetId: campaign.institutionId,
        })
        .select('followerUserId')
        .lean()
        .exec(),
    ]);

    const followerIds = Array.from(
      new Set(
        [...campaignFollows, ...institutionFollows].map((follow) =>
          follow.followerUserId.toString(),
        ),
      ),
    );

    await Promise.all(
      followerIds.map((followerId) => {
        const key = `${campaign._id.toString()}:${followerId}`;

        return this.notificationsService.createOnceByDataField(
          'campaignGoalReachedKey',
          key,
          {
            body: `A campanha "${campaign.title}" atingiu a meta de arrecadação!`,
            data: {
              campaignGoalReachedKey: key,
              campaignId: campaign._id.toString(),
            },
            title: 'Meta atingida! 🎉',
            type: NotificationType.CAMPAIGN_GOAL_REACHED,
            userId: new Types.ObjectId(followerId),
          },
        );
      }),
    );
  }

  private async queueReceiptGeneration(donationId: string, paymentId: string) {
    await this.queue.publish(
      env.receiptGenerateQueueName,
      createQueueMessage({
        idempotencyKey: `receipt-generate:${donationId}:${paymentId}`,
        payload: {
          donationId,
          paymentId,
        },
        type: 'receipt.generate',
      }),
    );
    this.logger.log(
      JSON.stringify({
        event: 'receipt_generation_queued',
        donationId,
        paymentId,
      }),
    );
  }
}
