import { EmailJobsService } from './email-jobs.service';

function createAppSettingsService(overrides: Record<string, string> = {}) {
  return {
    getString: jest.fn((_key: string, fallback: string) => {
      const value = overrides[_key];
      return Promise.resolve(value !== undefined ? value : fallback);
    }),
  };
}

describe('EmailJobsService', () => {
  describe('sendDonationReceiptEmail', () => {
    it('publishes an email.send message with the rendered receipt email', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService();
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendDonationReceiptEmail({
        amountFormatted: 'R$ 50,00',
        campaignTitle: 'Campanha X',
        institutionName: 'Instituto Y',
        name: 'Ana',
        receiptNumber: 'REC-1',
        to: 'ana@example.com',
        userId: 'user-1',
      });

      expect(queue.publish).toHaveBeenCalledTimes(1);
      const [queueName, message] = queue.publish.mock.calls[0];
      expect(queueName).toBe('email.send');
      expect(message.type).toBe('email.send');
      expect(message.idempotencyKey).toBe('email:donation-receipt:REC-1');
      expect(message.payload.to).toBe('ana@example.com');
      expect(message.payload.subject).toBe('Sua doação foi confirmada no EloDoar');
      expect(message.payload.text).toContain('Ana');
      expect(message.payload.text).toContain('R$ 50,00');
      expect(message.payload.text).toContain('Campanha X');
      expect(message.payload.text).toContain('REC-1');
      expect(message.payload.metadata).toEqual({
        receiptNumber: 'REC-1',
        template: 'donation-receipt',
        userId: 'user-1',
      });
      expect(message.payload.html).toContain('Campanha X');
      expect(message.payload.html).toContain('Instituto Y');
      expect(message.payload.html).toContain('Sua doação foi confirmada');
    });

    it('escapes HTML-sensitive characters in name, campaignTitle and institutionName', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService();
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendDonationReceiptEmail({
        amountFormatted: 'R$ 10,00',
        campaignTitle: '<b>Bold</b> & "Quoted"',
        institutionName: "Rock'n Roll",
        name: '<script>alert(1)</script>',
        receiptNumber: 'REC-2',
        to: 'x@example.com',
        userId: 'user-2',
      });

      const message = queue.publish.mock.calls[0][1];
      expect(message.payload.html).not.toContain('<script>');
      expect(message.payload.html).toContain('&lt;script&gt;');
      expect(message.payload.html).toContain('&amp;');
      expect(message.payload.html).toContain('&quot;Quoted&quot;');
      expect(message.payload.html).toContain('Rock&#039;n Roll');
    });

    it('renders the brand logo image when brandLogoUrl setting is present, and the fallback badge when absent', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };

      const withLogo = createAppSettingsService({
        EMAIL_BRAND_LOGO_URL: 'https://cdn.example.com/logo.png',
      });
      const serviceWithLogo = new EmailJobsService(queue as any, withLogo as any);
      await serviceWithLogo.sendDonationReceiptEmail({
        amountFormatted: 'R$ 1,00',
        campaignTitle: 'C',
        institutionName: 'I',
        name: 'N',
        receiptNumber: 'REC-3',
        to: 'a@example.com',
        userId: 'u',
      });
      const messageWithLogo = queue.publish.mock.calls[0][1];
      expect(messageWithLogo.payload.html).toContain('https://cdn.example.com/logo.png');
      expect(messageWithLogo.payload.html).toContain('<img');

      queue.publish.mockClear();
      const withoutLogo = createAppSettingsService({
        EMAIL_BRAND_HERO_URL: '',
        EMAIL_BRAND_LOGO_URL: '',
      });
      const serviceWithoutLogo = new EmailJobsService(queue as any, withoutLogo as any);
      await serviceWithoutLogo.sendDonationReceiptEmail({
        amountFormatted: 'R$ 1,00',
        campaignTitle: 'C',
        institutionName: 'I',
        name: 'N',
        receiptNumber: 'REC-4',
        to: 'a@example.com',
        userId: 'u',
      });
      const messageWithoutLogo = queue.publish.mock.calls[0][1];
      expect(messageWithoutLogo.payload.html).not.toContain('<img');
      expect(messageWithoutLogo.payload.html).toContain('&hearts;');
    });

    it('renders the hero image row only when brandHeroUrl is set', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService({
        EMAIL_BRAND_HERO_URL: 'https://cdn.example.com/hero.png',
      });
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendDonationReceiptEmail({
        amountFormatted: 'R$ 1,00',
        campaignTitle: 'C',
        institutionName: 'I',
        name: 'N',
        receiptNumber: 'REC-5',
        to: 'a@example.com',
        userId: 'u',
      });

      const message = queue.publish.mock.calls[0][1];
      expect(message.payload.html).toContain('https://cdn.example.com/hero.png');
      expect(message.payload.html).toContain('Pessoas conectadas por doações');
    });

    it('renders support items (email, phone, app url) when settings provide them, and a fallback when none are set', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };

      const withSupport = createAppSettingsService({
        EMAIL_PUBLIC_APP_URL: 'https://app.elodoar.com',
        EMAIL_SUPPORT_EMAIL: 'help@elodoar.com',
        EMAIL_SUPPORT_PHONE: '+55 11 90000-0000',
      });
      const serviceWithSupport = new EmailJobsService(queue as any, withSupport as any);
      await serviceWithSupport.sendDonationReceiptEmail({
        amountFormatted: 'R$ 1,00',
        campaignTitle: 'C',
        institutionName: 'I',
        name: 'N',
        receiptNumber: 'REC-6',
        to: 'a@example.com',
        userId: 'u',
      });
      const messageWithSupport = queue.publish.mock.calls[0][1];
      expect(messageWithSupport.payload.html).toContain('help@elodoar.com');
      expect(messageWithSupport.payload.html).toContain('+55 11 90000-0000');
      expect(messageWithSupport.payload.html).toContain('Abrir EloDoar');

      queue.publish.mockClear();
      const withoutSupport = createAppSettingsService({
        EMAIL_PUBLIC_APP_URL: '',
        EMAIL_SUPPORT_EMAIL: '',
        EMAIL_SUPPORT_PHONE: '',
      });
      const serviceWithoutSupport = new EmailJobsService(queue as any, withoutSupport as any);
      await serviceWithoutSupport.sendDonationReceiptEmail({
        amountFormatted: 'R$ 1,00',
        campaignTitle: 'C',
        institutionName: 'I',
        name: 'N',
        receiptNumber: 'REC-7',
        to: 'a@example.com',
        userId: 'u',
      });
      const messageWithoutSupport = queue.publish.mock.calls[0][1];
      expect(messageWithoutSupport.payload.html).toContain('Equipe EloDoar');
    });
  });

  describe('sendWeeklyDigestEmail', () => {
    it('publishes an email.send message summarizing the week with a list of campaign titles', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService();
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendWeeklyDigestEmail({
        campaignTitles: ['Campanha A', 'Campanha B'],
        donationsCount: 3,
        name: 'Bruno',
        to: 'bruno@example.com',
        totalAmountFormatted: 'R$ 120,00',
        userId: 'user-9',
      });

      expect(queue.publish).toHaveBeenCalledTimes(1);
      const [queueName, message] = queue.publish.mock.calls[0];
      expect(queueName).toBe('email.send');
      expect(message.idempotencyKey).toMatch(/^email:weekly-digest:user-9:\d{4}-\d{2}-\d{2}$/);
      expect(message.payload.subject).toBe('Seu resumo semanal no EloDoar');
      expect(message.payload.text).toContain('Bruno');
      expect(message.payload.text).toContain('R$ 120,00');
      expect(message.payload.text).toContain('3');
      expect(message.payload.html).toContain('<li>Campanha A</li>');
      expect(message.payload.html).toContain('<li>Campanha B</li>');
      expect(message.payload.metadata).toEqual({
        template: 'weekly-digest',
        userId: 'user-9',
      });
      // No primaryAction/highlight fallback link expected for the digest email.
      expect(message.payload.html).toContain('Total doado na semana');
    });

    it('escapes campaign titles containing HTML-sensitive characters', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService();
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendWeeklyDigestEmail({
        campaignTitles: ['<img src=x onerror=alert(1)>'],
        donationsCount: 1,
        name: 'Ana',
        to: 'a@example.com',
        totalAmountFormatted: 'R$ 5,00',
        userId: 'user-10',
      });

      const message = queue.publish.mock.calls[0][1];
      expect(message.payload.html).not.toContain('<img src=x onerror=alert(1)>');
      expect(message.payload.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('renders an empty list when campaignTitles is empty', async () => {
      const queue = { publish: jest.fn().mockResolvedValue(undefined) };
      const appSettingsService = createAppSettingsService();
      const service = new EmailJobsService(queue as any, appSettingsService as any);

      await service.sendWeeklyDigestEmail({
        campaignTitles: [],
        donationsCount: 0,
        name: 'Ana',
        to: 'a@example.com',
        totalAmountFormatted: 'R$ 0,00',
        userId: 'user-11',
      });

      const message = queue.publish.mock.calls[0][1];
      expect(message.payload.html).toContain('<ul style="padding-left:20px;margin:12px 0;"></ul>');
    });
  });
});
