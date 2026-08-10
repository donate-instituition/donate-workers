import { Injectable } from '@nestjs/common';

import type { QueueMessage } from '../../queues/queue.types';
import type { ReceiptGeneratePayload } from './receipt-generate.types';
import { TaxReceiptsService } from './tax-receipts.service';

@Injectable()
export class ReceiptGenerateHandlerService {
  constructor(private readonly taxReceiptsService: TaxReceiptsService) {}

  async handle(message: QueueMessage<ReceiptGeneratePayload>) {
    await this.taxReceiptsService.generateForPayment(
      message.payload.donationId,
      message.payload.paymentId,
    );
  }
}
