import { Injectable } from '@nestjs/common';

import { RedisService } from '../cache';
import { env } from '../config/env';
import type { IdempotencyStorePort } from './idempotency.types';

const KEY_PREFIX = 'idempotency:completed:';

@Injectable()
export class RedisIdempotencyStoreService implements IdempotencyStorePort {
  constructor(private readonly redisService: RedisService) {}

  async hasCompleted(idempotencyKey: string) {
    return (await this.redisService.get(KEY_PREFIX + idempotencyKey)) !== null;
  }

  async markCompleted(idempotencyKey: string) {
    await this.redisService.set(
      KEY_PREFIX + idempotencyKey,
      true,
      Math.ceil(env.idempotencyTtlMs / 1000),
    );
  }
}
