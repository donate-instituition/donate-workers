import { Types } from 'mongoose';

import { NotificationType } from '../../domains/notifications/models';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('returns the existing notification and does not create/publish when one already exists', async () => {
    const existing = { _id: new Types.ObjectId(), body: 'existing' };
    const notificationModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
      create: jest.fn(),
    };
    const queue = { publish: jest.fn() };
    const service = new NotificationsService(notificationModel as any, queue as any);

    const userId = new Types.ObjectId();
    const result = await service.createOnceByDataField('donationId', 'd1', {
      body: 'Body',
      title: 'Title',
      type: NotificationType.DONATION_STATUS_UPDATED,
      userId,
    });

    expect(result).toBe(existing);
    expect(notificationModel.findOne).toHaveBeenCalledWith({ 'data.donationId': 'd1' });
    expect(notificationModel.create).not.toHaveBeenCalled();
    expect(queue.publish).not.toHaveBeenCalled();
  });

  it('creates a new notification and publishes a push job when none exists', async () => {
    const userId = new Types.ObjectId();
    const notificationId = new Types.ObjectId();
    const created = {
      _id: notificationId,
      body: 'New donation confirmed',
      data: { donationId: 'd2' },
      title: 'Donation confirmed',
      type: NotificationType.DONATION_STATUS_UPDATED,
      userId,
    };
    const notificationModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue(created),
    };
    const queue = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationsService(notificationModel as any, queue as any);

    const result = await service.createOnceByDataField('donationId', 'd2', {
      body: created.body,
      data: created.data,
      title: created.title,
      type: created.type,
      userId,
    });

    expect(result).toBe(created);
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: created.body, title: created.title }),
    );
    expect(queue.publish).toHaveBeenCalledWith(
      'notification.push',
      expect.objectContaining({
        type: 'notification.push',
        payload: expect.objectContaining({
          body: created.body,
          notificationId: notificationId.toString(),
          title: created.title,
          userId: userId.toString(),
          data: expect.objectContaining({
            donationId: 'd2',
            notificationId: notificationId.toString(),
            type: created.type,
          }),
        }),
      }),
    );
  });

  it('publishes a push job with an empty data object when the notification has no data field', async () => {
    const userId = new Types.ObjectId();
    const notificationId = new Types.ObjectId();
    const created = {
      _id: notificationId,
      body: 'No data here',
      data: undefined,
      title: 'Title',
      type: NotificationType.NEW_FOLLOWER,
      userId,
    };
    const notificationModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue(created),
    };
    const queue = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationsService(notificationModel as any, queue as any);

    await service.createOnceByDataField('someField', 'val', {
      body: created.body,
      title: created.title,
      type: created.type,
      userId,
    });

    expect(queue.publish).toHaveBeenCalledWith(
      'notification.push',
      expect.objectContaining({
        payload: expect.objectContaining({
          data: {
            notificationId: notificationId.toString(),
            type: created.type,
          },
        }),
      }),
    );
  });
});
