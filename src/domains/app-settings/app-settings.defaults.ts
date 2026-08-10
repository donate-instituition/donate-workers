// Trimmed from donate-server's app-settings.defaults.ts — only the keys
// donate-workers actually reads (donate-server owns seeding/writing the
// full set of app settings).
export enum AppSettingKey {
  EMAIL_BRAND_HERO_URL = 'EMAIL_BRAND_HERO_URL',
  EMAIL_BRAND_LOGO_URL = 'EMAIL_BRAND_LOGO_URL',
  EMAIL_PUBLIC_APP_URL = 'EMAIL_PUBLIC_APP_URL',
  EMAIL_SUPPORT_EMAIL = 'EMAIL_SUPPORT_EMAIL',
  EMAIL_SUPPORT_PHONE = 'EMAIL_SUPPORT_PHONE',
  STRIPE_SERVICE_FEE_BPS = 'STRIPE_SERVICE_FEE_BPS',
}
