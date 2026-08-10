import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { closeRedisClient, ensureRedisConnected, increment } from './redis-client';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await closeRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await ensureRedisConnected();
    const raw = await client.get(key);

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = await ensureRedisConnected();
    const raw = JSON.stringify(value);

    if (ttlSeconds) {
      await client.set(key, raw, {
        expiration: { type: 'EX', value: ttlSeconds },
      });
      return;
    }

    await client.set(key, raw);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const client = await ensureRedisConnected();
    return client.del(keys);
  }

  /** Plain counter, no TTL. */
  increment(key: string, delta = 1) {
    return increment(key, delta);
  }
}
