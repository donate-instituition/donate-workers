import { ReceiptGenerateHandlerService } from './receipt-generate-handler.service';

describe('ReceiptGenerateHandlerService', () => {
  it('delegates to taxReceiptsService.generateForPayment with donationId and paymentId', async () => {
    const taxReceiptsService = { generateForPayment: jest.fn().mockResolvedValue(undefined) };
    const handler = new ReceiptGenerateHandlerService(taxReceiptsService as any);

    await handler.handle({
      attempt: 1,
      id: 'msg-1',
      idempotencyKey: 'key-1',
      payload: { donationId: 'donation-1', paymentId: 'payment-1' },
      publishedAt: new Date().toISOString(),
      type: 'receipt.generate',
    });

    expect(taxReceiptsService.generateForPayment).toHaveBeenCalledWith(
      'donation-1',
      'payment-1',
    );
  });

  it('propagates errors thrown by taxReceiptsService so WorkerRunnerService can retry', async () => {
    const taxReceiptsService = {
      generateForPayment: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const handler = new ReceiptGenerateHandlerService(taxReceiptsService as any);

    await expect(
      handler.handle({
        attempt: 1,
        id: 'msg-2',
        idempotencyKey: 'key-2',
        payload: { donationId: 'donation-2', paymentId: 'payment-2' },
        publishedAt: new Date().toISOString(),
        type: 'receipt.generate',
      }),
    ).rejects.toThrow('boom');
  });
});
