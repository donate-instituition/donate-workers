import { isWorkerEnabled } from '../../config/env';
import { StripeWebhookWorkerService } from './stripe-webhook-worker.service';

jest.mock('../../config/env', () => ({
  ...jest.requireActual('../../config/env'),
  isWorkerEnabled: jest.fn(),
}));

describe('StripeWebhookWorkerService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not start the worker when the stripe-webhook worker is disabled', () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(false);
    const stripeWebhookHandler = { handle: jest.fn() };
    const workerRunner = { start: jest.fn() };

    const service = new StripeWebhookWorkerService(
      stripeWebhookHandler as any,
      workerRunner as any,
    );
    service.onModuleInit();

    expect(workerRunner.start).not.toHaveBeenCalled();
  });

  it('starts the worker with the expected queue/dlq/retry config when enabled', () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(true);
    const unsubscribe = jest.fn();
    const stripeWebhookHandler = { handle: jest.fn() };
    const workerRunner = { start: jest.fn().mockReturnValue(unsubscribe) };

    const service = new StripeWebhookWorkerService(
      stripeWebhookHandler as any,
      workerRunner as any,
    );
    service.onModuleInit();

    expect(isWorkerEnabled).toHaveBeenCalledWith('stripe-webhook');
    expect(workerRunner.start).toHaveBeenCalledWith(
      expect.objectContaining({
        workerName: 'stripe-webhook',
        handler: expect.any(Function),
        retryPolicy: expect.any(Object),
      }),
    );
  });

  it('delegates to stripeWebhookHandler.handle via the handler passed to workerRunner.start', async () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(true);
    const stripeWebhookHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    let capturedHandler: ((message: unknown) => Promise<void>) | undefined;
    const workerRunner = {
      start: jest.fn((options) => {
        capturedHandler = options.handler;
        return jest.fn();
      }),
    };

    const service = new StripeWebhookWorkerService(
      stripeWebhookHandler as any,
      workerRunner as any,
    );
    service.onModuleInit();
    const message = { payload: { eventId: 'evt_1' } };
    await capturedHandler?.(message);

    expect(stripeWebhookHandler.handle).toHaveBeenCalledWith(message);
  });

  it('calls the stored unsubscribe function on shutdown when it was started', () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(true);
    const unsubscribe = jest.fn();
    const stripeWebhookHandler = { handle: jest.fn() };
    const workerRunner = { start: jest.fn().mockReturnValue(unsubscribe) };

    const service = new StripeWebhookWorkerService(
      stripeWebhookHandler as any,
      workerRunner as any,
    );
    service.onModuleInit();
    service.onApplicationShutdown();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not throw on shutdown when the worker was never started', () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(false);
    const stripeWebhookHandler = { handle: jest.fn() };
    const workerRunner = { start: jest.fn() };

    const service = new StripeWebhookWorkerService(
      stripeWebhookHandler as any,
      workerRunner as any,
    );
    service.onModuleInit();

    expect(() => service.onApplicationShutdown()).not.toThrow();
  });
});
