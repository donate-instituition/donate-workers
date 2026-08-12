import { NotificationPushHandlerService } from './notification-push-handler.service';

describe('NotificationPushHandlerService', () => {
  it('delegates to pushNotificationsService.sendToUser with the message payload', async () => {
    const pushNotificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new NotificationPushHandlerService(
      pushNotificationsService as any,
    );
    const message = {
      attempt: 1,
      id: 'msg-1',
      idempotencyKey: 'key-1',
      payload: { body: 'Corpo', title: 'Título', userId: 'user-1' },
      publishedAt: new Date().toISOString(),
      type: 'notification.push',
    };

    await handler.handle(message as any);

    expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
      message.payload,
    );
  });
});
