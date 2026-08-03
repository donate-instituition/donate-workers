import { Module } from '@nestjs/common';

import { IDEMPOTENCY_STORE } from './idempotency.types';
import { MemoryIdempotencyStoreService } from './memory-idempotency-store.service';

@Module({
  providers: [
    MemoryIdempotencyStoreService,
    {
      provide: IDEMPOTENCY_STORE,
      useExisting: MemoryIdempotencyStoreService,
    },
  ],
  exports: [IDEMPOTENCY_STORE, MemoryIdempotencyStoreService],
})
export class IdempotencyModule {}
