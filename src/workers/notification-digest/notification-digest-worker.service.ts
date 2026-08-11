import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env, isWorkerEnabled } from '../../config/env';
import { WeeklyDigestService } from './weekly-digest.service';

@Injectable()
export class NotificationDigestWorkerService {
  private readonly logger = new Logger(NotificationDigestWorkerService.name);

  constructor(private readonly weeklyDigestService: WeeklyDigestService) {}

  @Cron(env.digestCronExpression, { name: 'weekly-digest' })
  async handleCron() {
    if (!isWorkerEnabled('digest')) {
      return;
    }

    try {
      await this.weeklyDigestService.sendDigests();
    } catch (error) {
      this.logger.error(
        `Weekly digest run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
