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
            settings: { notifications: { donations: false } },
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
    // Donor disabled the donations category -> no notification/email side effects.
    expect(notificationsService.createOnceByDataField).not.toHaveBeenCalled();
    expect(emailJobsService.sendDonationReceiptEmail).not.toHaveBeenCalled();
  });

  it('creates a new receipt, generates a PDF and notifies the donor', async () => {
    const donationId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const campaignId = new Types.ObjectId();
    const institutionId = new Types.ObjectId();
    const donorUserId = new Types.ObjectId();

    const donationModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({ _id: donationId, campaignId, institutionId, donorUserId }),
      ),
    };
    const paymentModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({
          _id: paymentId,
          amount: 10_000,
          gatewayPayload: { serviceFeeAmount: 500, serviceFeeBps: 500 },
        }),
      ),
    };
    const newReceipt = {
      _id: new Types.ObjectId(),
      receiptNumber: 'ED-2026-NEW',
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      donationId,
      donorUserId,
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    const taxReceiptModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue(newReceipt),
    };
    const campaignModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createDoc({ title: 'Campanha Teste' })),
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
            cpf: '12345678900',
            settings: { notifications: { donations: true } },
          }),
        ),
      }),
    };
    const notificationsService = { createOnceByDataField: jest.fn().mockResolvedValue(undefined) };
    const emailJobsService = { sendDonationReceiptEmail: jest.fn().mockResolvedValue(undefined) };
    const objectStorage = {
      putObject: jest.fn().mockResolvedValue({
        bucket: 'test-bucket',
        checksum: 'abc',
        contentType: 'application/pdf',
        key: 'receipts/2026/inst/ED-2026-NEW.pdf',
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

    expect(taxReceiptModel.create).toHaveBeenCalled();
    expect(objectStorage.putObject).toHaveBeenCalled();
    expect(result).toBe(newReceipt);
    expect(newReceipt.save).toHaveBeenCalled();
    expect(notificationsService.createOnceByDataField).toHaveBeenCalledWith(
      'receiptNumber',
      'ED-2026-NEW',
      expect.objectContaining({ userId: donorUserId }),
    );
    expect(emailJobsService.sendDonationReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'doadora@example.com' }),
    );
  });

  it('throws when the donation or payment is not found', async () => {
    const donationModel = {
      findById: jest.fn().mockReturnValue(createDoc(null)),
    };
    const paymentModel = {
      findById: jest.fn().mockReturnValue(createDoc(null)),
    };
    const service = new TaxReceiptsService(
      {} as any,
      donationModel as any,
      paymentModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.generateForPayment('donation-1', 'payment-1'),
    ).rejects.toThrow('Donation or payment not found for receipt generation');
  });

  it('throws when the institution or donor is not found', async () => {
    const donationId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const donationModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({
          _id: donationId,
          campaignId: new Types.ObjectId(),
          institutionId: new Types.ObjectId(),
          donorUserId: new Types.ObjectId(),
        }),
      ),
    };
    const paymentModel = {
      findById: jest.fn().mockReturnValue(
        createDoc({ _id: paymentId, amount: 1000, gatewayPayload: {} }),
      ),
    };
    const campaignModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createDoc(null)),
      }),
    };
    const institutionModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createDoc(null)),
      }),
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createDoc(null)),
      }),
    };
    const taxReceiptModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    const service = new TaxReceiptsService(
      taxReceiptModel as any,
      donationModel as any,
      paymentModel as any,
      campaignModel as any,
      institutionModel as any,
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.generateForPayment(donationId.toString(), paymentId.toString()),
    ).rejects.toThrow('Institution or donor not found for receipt generation');
  });
});
