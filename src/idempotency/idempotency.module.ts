import { Module } from '@nestjs/common';

import { env } from '../config/env';
import { IDEMPOTENCY_STORE } from './idempotency.types';
import { MemoryIdempotencyStoreService } from './memory-idempotency-store.service';
import { RedisIdempotencyStoreService } from './redis-idempotency-store.service';

@Module({
  providers: [
    MemoryIdempotencyStoreService,
    RedisIdempotencyStoreService,
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (
        memoryStore: MemoryIdempotencyStoreService,
        redisStore: RedisIdempotencyStoreService,
      ) => {
        if (env.idempotencyProvider === 'memory') {
          return memoryStore;
        }

        if (env.idempotencyProvider === 'redis') {
          return redisStore;
        }

        throw new Error(
          `Unsupported IDEMPOTENCY_PROVIDER: ${env.idempotencyProvider}`,
        );
      },
      inject: [MemoryIdempotencyStoreService, RedisIdempotencyStoreService],
    },
  ],
  exports: [IDEMPOTENCY_STORE, MemoryIdempotencyStoreService],
})
export class IdempotencyModule {}
