import { isWorkerEnabled } from '../../config/env';
import { NotificationDigestWorkerService } from './notification-digest-worker.service';

jest.mock('../../config/env', () => ({
  ...jest.requireActual('../../config/env'),
  isWorkerEnabled: jest.fn(),
}));

describe('NotificationDigestWorkerService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when the digest worker is disabled', async () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(false);
    const weeklyDigestService = { sendDigests: jest.fn() };
    const service = new NotificationDigestWorkerService(
      weeklyDigestService as any,
    );

    await service.handleCron();

    expect(weeklyDigestService.sendDigests).not.toHaveBeenCalled();
  });

  it('runs the digest when enabled', async () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(true);
    const weeklyDigestService = {
      sendDigests: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NotificationDigestWorkerService(
      weeklyDigestService as any,
    );

    await service.handleCron();

    expect(isWorkerEnabled).toHaveBeenCalledWith('digest');
    expect(weeklyDigestService.sendDigests).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows the error instead of throwing when sendDigests fails', async () => {
    (isWorkerEnabled as jest.Mock).mockReturnValue(true);
    const weeklyDigestService = {
      sendDigests: jest.fn().mockRejectedValue(new Error('Mongo down')),
    };
    const service = new NotificationDigestWorkerService(
      weeklyDigestService as any,
    );

    await expect(service.handleCron()).resolves.toBeUndefined();
  });
});
