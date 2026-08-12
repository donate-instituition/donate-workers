import { env } from '../config/env';
import { RedisIdempotencyStoreService } from './redis-idempotency-store.service';

describe('RedisIdempotencyStoreService', () => {
  describe('hasCompleted', () => {
    it('returns true when a completion marker exists in redis', async () => {
      const redisService = { get: jest.fn().mockResolvedValue(true) };
      const store = new RedisIdempotencyStoreService(redisService as any);

      const result = await store.hasCompleted('key-1');

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(
        'idempotency:completed:key-1',
      );
    });

    it('returns false when there is no completion marker', async () => {
      const redisService = { get: jest.fn().mockResolvedValue(null) };
      const store = new RedisIdempotencyStoreService(redisService as any);

      const result = await store.hasCompleted('key-1');

      expect(result).toBe(false);
    });
  });

  describe('markCompleted', () => {
    it('stores a completion marker with the configured TTL', async () => {
      const redisService = { set: jest.fn().mockResolvedValue(undefined) };
      const store = new RedisIdempotencyStoreService(redisService as any);

      await store.markCompleted('key-1');

      expect(redisService.set).toHaveBeenCalledWith(
        'idempotency:completed:key-1',
        true,
        Math.ceil(env.idempotencyTtlMs / 1000),
      );
    });
  });
});
