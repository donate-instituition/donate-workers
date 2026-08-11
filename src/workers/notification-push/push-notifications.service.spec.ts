import { Types } from 'mongoose';

import { NotificationType } from '../../domains/notifications/models';
import { PushNotificationsService } from './push-notifications.service';

function createUserQuery(userDoc: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(userDoc),
      }),
    }),
  };
}

function createService(userDoc: unknown, sendResult: unknown = 'message-id') {
  const userModel = {
    findById: jest.fn().mockReturnValue(createUserQuery(userDoc)),
  };
  const firebaseAdminService = { send: jest.fn().mockResolvedValue(sendResult) };
  const service = new PushNotificationsService(
    userModel as any,
    firebaseAdminService as any,
  );

  return { firebaseAdminService, service, userModel };
}

describe('PushNotificationsService', () => {
  it('does nothing when the user is not found', async () => {
    const { firebaseAdminService, service } = createService(null);

    await service.sendToUser({
      body: 'Corpo',
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).not.toHaveBeenCalled();
  });

  it('sends when the notification type has no mapped category', async () => {
    const { firebaseAdminService, service } = createService({
      settings: {
        notifications: {
          campaigns: false,
          conversations: false,
          donations: false,
        },
      },
      pushTokens: [{ token: 'abc', disabledAt: undefined }],
    });

    await service.sendToUser({
      body: 'Corpo',
      data: { type: NotificationType.NEW_FOLLOWER },
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).toHaveBeenCalledTimes(1);
  });

  it.each([
    [NotificationType.DONATION_STATUS_UPDATED, 'donations'],
    [NotificationType.NEW_MESSAGE, 'conversations'],
    [NotificationType.CAMPAIGN_GOAL_REACHED, 'campaigns'],
  ] as const)(
    'skips %s push when its category (%s) is disabled',
    async (type, category) => {
      const { firebaseAdminService, service } = createService({
        settings: { notifications: { [category]: false } },
        pushTokens: [{ token: 'abc', disabledAt: undefined }],
      });

      await service.sendToUser({
        body: 'Corpo',
        data: { type },
        title: 'Título',
        userId: new Types.ObjectId().toString(),
      });

      expect(firebaseAdminService.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    [NotificationType.DONATION_STATUS_UPDATED, 'donations'],
    [NotificationType.NEW_MESSAGE, 'conversations'],
    [NotificationType.CAMPAIGN_GOAL_REACHED, 'campaigns'],
  ] as const)(
    'sends %s push when its category (%s) is enabled',
    async (type, category) => {
      const { firebaseAdminService, service } = createService({
        settings: { notifications: { [category]: true } },
        pushTokens: [{ token: 'abc', disabledAt: undefined }],
      });

      await service.sendToUser({
        body: 'Corpo',
        data: { type },
        title: 'Título',
        userId: new Types.ObjectId().toString(),
      });

      expect(firebaseAdminService.send).toHaveBeenCalledTimes(1);
    },
  );

  it('does not call Firebase when the user has no enabled push tokens', async () => {
    const { firebaseAdminService, service } = createService({
      settings: { notifications: { donations: true } },
      pushTokens: [{ token: 'abc', disabledAt: new Date() }],
    });

    await service.sendToUser({
      body: 'Corpo',
      data: { type: NotificationType.DONATION_STATUS_UPDATED },
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).not.toHaveBeenCalled();
  });

  it('sends one push per enabled token', async () => {
    const { firebaseAdminService, service } = createService({
      settings: { notifications: { donations: true } },
      pushTokens: [
        { token: 'token-1', disabledAt: undefined },
        { token: 'token-2', disabledAt: undefined },
        { token: 'token-3', disabledAt: new Date() },
      ],
    });

    await service.sendToUser({
      body: 'Corpo',
      data: { type: NotificationType.DONATION_STATUS_UPDATED },
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).toHaveBeenCalledTimes(2);
    expect(firebaseAdminService.send).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token-1' }),
    );
    expect(firebaseAdminService.send).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token-2' }),
    );
  });
});
