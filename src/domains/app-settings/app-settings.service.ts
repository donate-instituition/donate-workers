import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppSettingKey } from './app-settings.defaults';
import { AppSetting, AppSettingDocument } from './schemas/app-setting.schema';

// Read-only: donate-server owns seeding/writing app settings via its own
// AppSettingsService, both point at the same `app_settings` collection.
@Injectable()
export class AppSettingsService {
  constructor(
    @InjectModel(AppSetting.name)
    private readonly appSettingModel: Model<AppSettingDocument>,
  ) {}

  async getNumber(key: AppSettingKey, fallback = 0) {
    const setting = await this.appSettingModel.findOne({ key }).exec();
    const parsed = Number(setting?.value);

    return Number.isNaN(parsed) ? fallback : parsed;
  }

  async getString(key: AppSettingKey, fallback = '') {
    const setting = await this.appSettingModel.findOne({ key }).exec();
    const value = setting?.value;

    if (value === undefined || value === null) {
      return fallback;
    }

    return String(value);
  }
}
