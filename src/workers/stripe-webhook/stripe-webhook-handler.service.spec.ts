import { Types } from 'mongoose';

import { StripeWebhookHandlerService } from './stripe-webhook-handler.service';

function createModelMock() {
  return {
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
    findByIdAndUpdate: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

describe('StripeWebhookHandlerService', () => {
  it('skips processing when the event is already processed (or unknown)', async () => {
    const stripeWebhookEventModel = createModelMock();
    const paymentModel = {};
    const donationModel = {};
    const campaignModel = {};
    const institutionModel = {};
    const followModel = {};
    const appSettingsService = { getNumber: jest.fn() };
    const redisService = { del: jest.fn(), increment: jest.fn() };
    const notificationsService = { createOnceByDataField: jest.fn() };
    const queue = { publish: jest.fn() };

    const handler = new StripeWebhookHandlerService(
      stripeWebhookEventModel as any,
      paymentModel as any,
      donationModel as any,
      campaignModel as any,
      institutionModel as any,
      followModel as any,
      appSettingsService as any,
      redisService as any,
      notificationsService as any,
      queue as any,
    );

    await handler.processQueuedEvent('evt_123');

    expect(stripeWebhookEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_123' }),
      expect.any(Object),
      expect.any(Object),
    );
    // No event record returned -> nothing else should run.
    expect(stripeWebhookEventModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(queue.publish).not.toHaveBeenCalled();
  });

  it('marks the event FAILED and rethrows when a handler throws, so WorkerRunnerService can retry it', async () => {
    const stripeWebhookEventModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'record-1',
          payload: { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } },
        }),
      }),
      findByIdAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    // paymentModel.findOne throws to simulate a downstream failure.
    const paymentModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
      }),
    };
    const handler = new StripeWebhookHandlerService(
      stripeWebhookEventModel as any,
      paymentModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getNumber: jest.fn() } as any,
      { del: jest.fn(), increment: jest.fn() } as any,
      { createOnceByDataField: jest.fn() } as any,
      { publish: jest.fn() } as any,
    );

    await expect(handler.processQueuedEvent('evt_1')).rejects.toThrow(
      'Mongo unavailable',
    );

    expect(stripeWebhookEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'record-1',
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  describe('campaign goal-reached notification', () => {
    function createFollowModel(byType: Record<string, unknown[]>) {
      return {
        find: jest.fn((query: { targetType: string }) => ({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(byType[query.targetType] ?? []),
            }),
          }),
        })),
      };
    }

    function createHandler(
      followModel: ReturnType<typeof createFollowModel>,
      notificationsService: { createOnceByDataField: jest.Mock },
    ) {
      return new StripeWebhookHandlerService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        followModel as any,
        { getNumber: jest.fn() } as any,
        { del: jest.fn(), increment: jest.fn() } as any,
        notificationsService as any,
        { publish: jest.fn() } as any,
      );
    }

    function buildCampaign(moneyTarget: number, moneyRaisedAfter: number) {
      return {
        _id: new Types.ObjectId(),
        goal: { moneyTarget },
        institutionId: new Types.ObjectId(),
        progress: { moneyRaised: moneyRaisedAfter },
        title: 'Campanha Teste',
      };
    }

    it('notifies followers when a payment crosses the goal', async () => {
      const followerId = new Types.ObjectId();
      const followModel = createFollowModel({
        CAMPAIGN: [{ followerUserId: followerId }],
        INSTITUTION: [],
      });
      const notificationsService = { createOnceByDataField: jest.fn() };
      const handler = createHandler(followModel, notificationsService);
      // before = 1000 - 200 = 800 < target(1000) <= after(1000)
      const campaign = buildCampaign(1000, 1000);

      await (handler as any).notifyCampaignGoalReachedIfCrossed(campaign, 200);

      expect(notificationsService.createOnceByDataField).toHaveBeenCalledTimes(1);
      expect(notificationsService.createOnceByDataField).toHaveBeenCalledWith(
        'campaignGoalReachedKey',
        `${campaign._id.toString()}:${followerId.toString()}`,
        expect.objectContaining({ type: 'CAMPAIGN_GOAL_REACHED' }),
      );
    });

    it('does not notify when the campaign was already past goal before this payment', async () => {
      const followModel = createFollowModel({
        CAMPAIGN: [{ followerUserId: new Types.ObjectId() }],
        INSTITUTION: [],
      });
      const notificationsService = { createOnceByDataField: jest.fn() };
      const handler = createHandler(followModel, notificationsService);
      // before = 1400 - 200 = 1200 >= target(1000) -> already past goal, no re-fire
      const campaign = buildCampaign(1000, 1400);

      await (handler as any).notifyCampaignGoalReachedIfCrossed(campaign, 200);

      expect(notificationsService.createOnceByDataField).not.toHaveBeenCalled();
    });

    it('does not notify when the goal has not been reached yet', async () => {
      const followModel = createFollowModel({
        CAMPAIGN: [{ followerUserId: new Types.ObjectId() }],
        INSTITUTION: [],
      });
      const notificationsService = { createOnceByDataField: jest.fn() };
      const handler = createHandler(followModel, notificationsService);
      // after = 800 < target(1000)
      const campaign = buildCampaign(1000, 800);

      await (handler as any).notifyCampaignGoalReachedIfCrossed(campaign, 200);

      expect(notificationsService.createOnceByDataField).not.toHaveBeenCalled();
    });

    it('does not notify when the campaign has no goal set', async () => {
      const followModel = createFollowModel({
        CAMPAIGN: [{ followerUserId: new Types.ObjectId() }],
        INSTITUTION: [],
      });
      const notificationsService = { createOnceByDataField: jest.fn() };
      const handler = createHandler(followModel, notificationsService);
      const campaign = buildCampaign(0, 200);

      await (handler as any).notifyCampaignGoalReachedIfCrossed(campaign, 200);

      expect(notificationsService.createOnceByDataField).not.toHaveBeenCalled();
    });

    it('dedupes a user who follows both the campaign and its institution', async () => {
      const followerId = new Types.ObjectId();
      const followModel = createFollowModel({
        CAMPAIGN: [{ followerUserId: followerId }],
        INSTITUTION: [{ followerUserId: followerId }],
      });
      const notificationsService = { createOnceByDataField: jest.fn() };
      const handler = createHandler(followModel, notificationsService);
      const campaign = buildCampaign(1000, 1000);

      await (handler as any).notifyCampaignGoalReachedIfCrossed(campaign, 200);

      expect(notificationsService.createOnceByDataField).toHaveBeenCalledTimes(1);
    });
  });
});
