import { Injectable } from '@nestjs/common';

import type { IdempotencyStorePort } from './idempotency.types';

@Injectable()
export class MemoryIdempotencyStoreService implements IdempotencyStorePort {
  private readonly completedKeys = new Set<string>();

  async hasCompleted(idempotencyKey: string) {
    return this.completedKeys.has(idempotencyKey);
  }

  async markCompleted(idempotencyKey: string) {
    this.completedKeys.add(idempotencyKey);
  }
}
