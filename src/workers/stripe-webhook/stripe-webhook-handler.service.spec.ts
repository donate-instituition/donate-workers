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
    const appSettingsService = { getNumber: jest.fn() };
    const redisService = { del: jest.fn(), increment: jest.fn() };
    const queue = { publish: jest.fn() };

    const handler = new StripeWebhookHandlerService(
      stripeWebhookEventModel as any,
      paymentModel as any,
      donationModel as any,
      campaignModel as any,
      institutionModel as any,
      appSettingsService as any,
      redisService as any,
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
      { getNumber: jest.fn() } as any,
      { del: jest.fn(), increment: jest.fn() } as any,
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
});
