import { Types } from 'mongoose';

import { WeeklyDigestService } from './weekly-digest.service';

function createQuery(result: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('WeeklyDigestService', () => {
  it('skips users with no donations in the last 7 days', async () => {
    const userId = new Types.ObjectId();
    const userModel = {
      find: jest.fn().mockReturnValue(
        createQuery([{ _id: userId, email: 'a@example.com', fullName: 'A' }]),
      ),
    };
    const donationModel = { find: jest.fn().mockReturnValue(createQuery([])) };
    const campaignModel = { find: jest.fn() };
    const emailJobsService = { sendWeeklyDigestEmail: jest.fn() };

    const service = new WeeklyDigestService(
      userModel as any,
      donationModel as any,
      campaignModel as any,
      emailJobsService as any,
    );

    await service.sendDigests();

    expect(emailJobsService.sendWeeklyDigestEmail).not.toHaveBeenCalled();
  });

  it('sends a digest email summarizing the week for an active donor', async () => {
    const userId = new Types.ObjectId();
    const campaignId = new Types.ObjectId();
    const userModel = {
      find: jest.fn().mockReturnValue(
        createQuery([
          { _id: userId, email: 'a@example.com', fullName: 'Ana' },
        ]),
      ),
    };
    const donationModel = {
      find: jest.fn().mockReturnValue(
        createQuery([
          { campaignId, moneyDonation: { amount: 50 } },
          { campaignId, moneyDonation: { amount: 30 } },
        ]),
      ),
    };
    const campaignModel = {
      find: jest.fn().mockReturnValue(
        createQuery([{ _id: campaignId, title: 'Campanha X' }]),
      ),
    };
    const emailJobsService = { sendWeeklyDigestEmail: jest.fn() };

    const service = new WeeklyDigestService(
      userModel as any,
      donationModel as any,
      campaignModel as any,
      emailJobsService as any,
    );

    await service.sendDigests();

    expect(emailJobsService.sendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignTitles: ['Campanha X'],
        donationsCount: 2,
        to: 'a@example.com',
        totalAmountFormatted: 'R$ 80,00',
        userId: userId.toString(),
      }),
    );
  });

  it('only considers users with emailDigestEnabled true', async () => {
    const userModel = {
      find: jest.fn().mockReturnValue(createQuery([])),
    };
    const donationModel = { find: jest.fn() };
    const campaignModel = { find: jest.fn() };
    const emailJobsService = { sendWeeklyDigestEmail: jest.fn() };

    const service = new WeeklyDigestService(
      userModel as any,
      donationModel as any,
      campaignModel as any,
      emailJobsService as any,
    );

    await service.sendDigests();

    expect(userModel.find).toHaveBeenCalledWith({
      'settings.notifications.emailDigestEnabled': true,
    });
    expect(donationModel.find).not.toHaveBeenCalled();
  });
});
