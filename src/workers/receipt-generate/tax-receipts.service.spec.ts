import { Types } from 'mongoose';

import { TaxReceiptsService } from './tax-receipts.service';

function createDoc(overrides: Record<string, unknown> = {}) {
  return { exec: jest.fn().mockResolvedValue(overrides) };
}

describe('TaxReceiptsService', () => {
  it('reuses the existing tax receipt for a payment instead of creating a duplicate', async () => {
    const donationId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const campaignId = new Types.ObjectId();
    const institutionId = new Types.ObjectId();
    const donorUserId = new Types.ObjectId();

    const donationModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({
          _id: donationId,
          campaignId,
          institutionId,
          donorUserId,
        }),
      ),
    };
    const paymentModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({
          _id: paymentId,
          amount: 10_000,
          gatewayPayload: {},
        }),
      ),
    };
    const existingReceipt = {
      _id: new Types.ObjectId(),
      receiptNumber: 'ED-2026-EXISTING',
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      donationId,
      donorUserId,
      metadata: { paymentId: paymentId.toString() },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const taxReceiptModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingReceipt),
      }),
      create: jest.fn(),
    };
    const campaignModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createDoc({ title: 'Campanha Teste' }),
        ),
      }),
    };
    const institutionModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createDoc({ displayName: 'Instituto Teste', cnpj: '00000000000000' }),
        ),
      }),
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(
          createDoc({
            _id: donorUserId,
            fullName: 'Doadora Teste',
            email: 'doadora@example.com',
            settings: { notifications: { push: false, email: false } },
          }),
        ),
      }),
    };
    const notificationsService = { createOnceByDataField: jest.fn() };
    const emailJobsService = { sendDonationReceiptEmail: jest.fn() };
    const objectStorage = {
      putObject: jest.fn().mockResolvedValue({
        bucket: undefined,
        checksum: 'abc',
        contentType: 'application/pdf',
        key: 'receipts/2026/inst/ED-2026-EXISTING.pdf',
        provider: 'local',
        size: 1234,
      }),
    };

    const service = new TaxReceiptsService(
      taxReceiptModel as any,
      donationModel as any,
      paymentModel as any,
      campaignModel as any,
      institutionModel as any,
      userModel as any,
      notificationsService as any,
      emailJobsService as any,
      objectStorage as any,
    );

    const result = await service.generateForPayment(
      donationId.toString(),
      paymentId.toString(),
    );

    expect(taxReceiptModel.create).not.toHaveBeenCalled();
    expect(result).toBe(existingReceipt);
    expect(existingReceipt.save).toHaveBeenCalled();
    // Donor disabled both channels -> no notification/email side effects.
    expect(notificationsService.createOnceByDataField).not.toHaveBeenCalled();
    expect(emailJobsService.sendDonationReceiptEmail).not.toHaveBeenCalled();
  });
});
