import { Types } from 'mongoose';

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

describe('PushNotificationsService', () => {
  it('does not call Firebase when the user has push notifications disabled', async () => {
    const userModel = {
      findById: jest.fn().mockReturnValue(
        createUserQuery({
          settings: { notifications: { push: false } },
          pushTokens: [{ token: 'abc', disabledAt: undefined }],
        }),
      ),
    };
    const firebaseAdminService = { send: jest.fn() };
    const service = new PushNotificationsService(
      userModel as any,
      firebaseAdminService as any,
    );

    await service.sendToUser({
      body: 'Corpo',
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).not.toHaveBeenCalled();
  });

  it('does not call Firebase when the user has no enabled push tokens', async () => {
    const userModel = {
      findById: jest.fn().mockReturnValue(
        createUserQuery({
          settings: { notifications: { push: true } },
          pushTokens: [{ token: 'abc', disabledAt: new Date() }],
        }),
      ),
    };
    const firebaseAdminService = { send: jest.fn() };
    const service = new PushNotificationsService(
      userModel as any,
      firebaseAdminService as any,
    );

    await service.sendToUser({
      body: 'Corpo',
      title: 'Título',
      userId: new Types.ObjectId().toString(),
    });

    expect(firebaseAdminService.send).not.toHaveBeenCalled();
  });

  it('sends one push per enabled token', async () => {
    const userModel = {
      findById: jest.fn().mockReturnValue(
        createUserQuery({
          settings: { notifications: { push: true } },
          pushTokens: [
            { token: 'token-1', disabledAt: undefined },
            { token: 'token-2', disabledAt: undefined },
            { token: 'token-3', disabledAt: new Date() },
          ],
        }),
      ),
    };
    const firebaseAdminService = { send: jest.fn().mockResolvedValue('message-id') };
    const service = new PushNotificationsService(
      userModel as any,
      firebaseAdminService as any,
    );

    await service.sendToUser({
      body: 'Corpo',
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
