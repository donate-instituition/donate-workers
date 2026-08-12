import { closeRedisClient, ensureRedisConnected, increment } from './redis-client';
import { RedisService } from './redis.service';

jest.mock('./redis-client', () => ({
  closeRedisClient: jest.fn(),
  ensureRedisConnected: jest.fn(),
  increment: jest.fn(),
}));

function mockClient() {
  return { get: jest.fn(), set: jest.fn(), del: jest.fn() };
}

describe('RedisService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns the parsed value when present', async () => {
      const client = mockClient();
      client.get.mockResolvedValue(JSON.stringify({ a: 1 }));
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      const result = await service.get('key');

      expect(result).toEqual({ a: 1 });
      expect(client.get).toHaveBeenCalledWith('key');
    });

    it('returns null when the key is missing', async () => {
      const client = mockClient();
      client.get.mockResolvedValue(null);
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      const result = await service.get('missing');

      expect(result).toBeNull();
    });

    it('returns null when the stored value is not valid JSON', async () => {
      const client = mockClient();
      client.get.mockResolvedValue('{not-json');
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      const result = await service.get('bad');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('sets without expiration when no TTL is given', async () => {
      const client = mockClient();
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      await service.set('key', { a: 1 });

      expect(client.set).toHaveBeenCalledWith('key', JSON.stringify({ a: 1 }));
    });

    it('sets with an EX expiration when a TTL is given', async () => {
      const client = mockClient();
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      await service.set('key', { a: 1 }, 60);

      expect(client.set).toHaveBeenCalledWith('key', JSON.stringify({ a: 1 }), {
        expiration: { type: 'EX', value: 60 },
      });
    });
  });

  describe('del', () => {
    it('returns 0 without calling redis when no keys are given', async () => {
      const service = new RedisService();

      const result = await service.del();

      expect(result).toBe(0);
      expect(ensureRedisConnected).not.toHaveBeenCalled();
    });

    it('deletes the given keys', async () => {
      const client = mockClient();
      client.del.mockResolvedValue(2);
      (ensureRedisConnected as jest.Mock).mockResolvedValue(client);
      const service = new RedisService();

      const result = await service.del('a', 'b');

      expect(result).toBe(2);
      expect(client.del).toHaveBeenCalledWith(['a', 'b']);
    });
  });

  describe('increment', () => {
    it('delegates to the shared increment helper', async () => {
      (increment as jest.Mock).mockResolvedValue(5);
      const service = new RedisService();

      const result = await service.increment('counter', 3);

      expect(increment).toHaveBeenCalledWith('counter', 3);
      expect(result).toBe(5);
    });
  });

  describe('onApplicationShutdown', () => {
    it('closes the redis client', async () => {
      const service = new RedisService();

      await service.onApplicationShutdown();

      expect(closeRedisClient).toHaveBeenCalledTimes(1);
    });
  });
});
