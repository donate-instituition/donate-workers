import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Campaign,
  CampaignDocument,
} from '../../domains/campaigns/schemas/campaign.schema';
import { DonationStatus } from '../../domains/donations/models';
import {
  Donation,
  DonationDocument,
} from '../../domains/donations/schemas/donation.schema';
import { User, UserDocument } from '../../domains/users/schemas/user.schema';
import { EmailJobsService } from '../receipt-generate/email-jobs.service';

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    private readonly emailJobsService: EmailJobsService,
  ) {}

  async sendDigests() {
    const users = await this.userModel
      .find({ 'settings.notifications.emailDigestEnabled': true })
      .select('_id fullName email')
      .lean()
      .exec();

    let sent = 0;

    for (const user of users) {
      const wasSent = await this.sendDigestForUser(user);
      if (wasSent) {
        sent += 1;
      }
    }

    this.logger.log(
      JSON.stringify({
        event: 'weekly_digest_run_completed',
        emailsSent: sent,
        usersChecked: users.length,
      }),
    );
  }

  private async sendDigestForUser(user: {
    _id: Types.ObjectId;
    email: string;
    fullName?: string;
  }) {
    const since = new Date(Date.now() - DIGEST_WINDOW_MS);

    const donations = await this.donationModel
      .find({
        createdAt: { $gte: since },
        donorUserId: user._id,
        status: DonationStatus.PAID,
      })
      .select('campaignId moneyDonation')
      .lean()
      .exec();

    if (!donations.length) {
      return false;
    }

    const totalAmount = donations.reduce(
      (sum, donation) => sum + (donation.moneyDonation?.amount ?? 0),
      0,
    );
    const campaignIds = Array.from(
      new Set(
        donations
          .map((donation) => donation.campaignId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const campaigns = campaignIds.length
      ? await this.campaignModel
          .find({ _id: { $in: campaignIds } })
          .select('title')
          .lean()
          .exec()
      : [];

    await this.emailJobsService.sendWeeklyDigestEmail({
      campaignTitles: campaigns.map((campaign) => campaign.title),
      donationsCount: donations.length,
      name: user.fullName ?? user.email,
      to: user.email,
      totalAmountFormatted: this.formatCurrency(totalAmount),
      userId: user._id.toString(),
    });

    return true;
  }

  private formatCurrency(amount: number) {
    return `R$ ${amount.toFixed(2).replace('.', ',')}`;
  }
}
