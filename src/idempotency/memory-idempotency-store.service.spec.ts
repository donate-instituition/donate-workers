import { MemoryIdempotencyStoreService } from './memory-idempotency-store.service';

describe('MemoryIdempotencyStoreService', () => {
  it('returns false for a key that has not been marked completed', async () => {
    const store = new MemoryIdempotencyStoreService();

    expect(await store.hasCompleted('key-1')).toBe(false);
  });

  it('returns true for a key after it has been marked completed', async () => {
    const store = new MemoryIdempotencyStoreService();

    await store.markCompleted('key-1');

    expect(await store.hasCompleted('key-1')).toBe(true);
  });

  it('keeps completion state isolated per key', async () => {
    const store = new MemoryIdempotencyStoreService();

    await store.markCompleted('key-1');

    expect(await store.hasCompleted('key-2')).toBe(false);
  });
});
