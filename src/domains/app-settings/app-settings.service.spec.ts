import { AppSettingKey } from './app-settings.defaults';
import { AppSettingsService } from './app-settings.service';

function createModel(setting: unknown) {
  return {
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(setting),
    }),
  };
}

describe('AppSettingsService', () => {
  describe('getNumber', () => {
    it('returns the parsed numeric value when the setting exists', async () => {
      const model = createModel({
        key: AppSettingKey.STRIPE_SERVICE_FEE_BPS,
        value: '150',
      });
      const service = new AppSettingsService(model as any);

      const result = await service.getNumber(
        AppSettingKey.STRIPE_SERVICE_FEE_BPS,
        0,
      );

      expect(result).toBe(150);
      expect(model.findOne).toHaveBeenCalledWith({
        key: AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      });
    });

    it('returns the fallback when the setting does not exist', async () => {
      const model = createModel(null);
      const service = new AppSettingsService(model as any);

      const result = await service.getNumber(
        AppSettingKey.STRIPE_SERVICE_FEE_BPS,
        42,
      );

      expect(result).toBe(42);
    });

    it('returns the fallback when the stored value is not numeric', async () => {
      const model = createModel({ value: 'not-a-number' });
      const service = new AppSettingsService(model as any);

      const result = await service.getNumber(
        AppSettingKey.STRIPE_SERVICE_FEE_BPS,
        7,
      );

      expect(result).toBe(7);
    });

    it('defaults the fallback to 0 when not provided', async () => {
      const model = createModel(null);
      const service = new AppSettingsService(model as any);

      const result = await service.getNumber(
        AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      );

      expect(result).toBe(0);
    });
  });

  describe('getString', () => {
    it('returns the stringified value when the setting exists', async () => {
      const model = createModel({ value: 'https://example.com/logo.png' });
      const service = new AppSettingsService(model as any);

      const result = await service.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
        'fallback',
      );

      expect(result).toBe('https://example.com/logo.png');
    });

    it('returns the fallback when the setting does not exist', async () => {
      const model = createModel(null);
      const service = new AppSettingsService(model as any);

      const result = await service.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
        'fallback',
      );

      expect(result).toBe('fallback');
    });

    it('returns the fallback when the stored value is null', async () => {
      const model = createModel({ value: null });
      const service = new AppSettingsService(model as any);

      const result = await service.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
        'fallback',
      );

      expect(result).toBe('fallback');
    });

    it('coerces a non-string stored value to a string', async () => {
      const model = createModel({ value: 42 });
      const service = new AppSettingsService(model as any);

      const result = await service.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
        'fallback',
      );

      expect(result).toBe('42');
    });

    it('defaults the fallback to empty string when not provided', async () => {
      const model = createModel(null);
      const service = new AppSettingsService(model as any);

      const result = await service.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
      );

      expect(result).toBe('');
    });
  });
});
