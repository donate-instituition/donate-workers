import { Logger } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { env } from '../config/env';

const logger = new Logger('Redis');
// How long a caller waits for a connection before failing open. The
// underlying client keeps retrying in the background via reconnectStrategy
// regardless of this timeout, so Redis coming back later self-heals it.
const CONNECT_WAIT_TIMEOUT_MS = 1_500;

let client: RedisClientType | undefined;
let connectPromise: Promise<RedisClientType> | undefined;

function createRedisClient(): RedisClientType {
  const redisClient = createClient({
    url: env.redisUrl,
    keyPrefix: env.redisKeyPrefix,
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });

  // While Redis is down, `reconnectStrategy` retries every few seconds and
  // each failed attempt fires its own 'error' event — logging every one of
  // those at WARN would spam the console for as long as it's down. Log the
  // first failure, go quiet, then announce when it comes back.
  let isDown = false;

  redisClient.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);

    if (isDown) {
      logger.debug(JSON.stringify({ event: 'redis_still_unreachable', message }));
      return;
    }

    isDown = true;
    logger.warn(JSON.stringify({ event: 'redis_client_error', message }));
  });
  redisClient.on('reconnecting', () => {
    logger.debug(JSON.stringify({ event: 'redis_reconnecting' }));
  });
  redisClient.on('ready', () => {
    logger.log(
      JSON.stringify({ event: isDown ? 'redis_reconnected' : 'redis_connected' }),
    );
    isDown = false;
  });

  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!client) {
    client = createRedisClient();
  }

  return client;
}

export async function ensureRedisConnected(): Promise<RedisClientType> {
  const redisClient = getRedisClient();

  if (redisClient.isReady) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient
      .connect()
      .then(() => redisClient)
      .finally(() => {
        connectPromise = undefined;
      });
  }

  // reconnectStrategy retries forever in the background, so `connect()` may
  // never settle while Redis is down; bound how long a caller waits for it.
  return withRedisTimeout(
    connectPromise,
    CONNECT_WAIT_TIMEOUT_MS,
    'Redis connect',
  );
}

export async function closeRedisClient() {
  if (!client) {
    return;
  }

  const redisClient = client;
  client = undefined;
  await redisClient.quit().catch(() => redisClient.disconnect());
}

export async function withRedisTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Plain INCRBY, no TTL. */
export async function increment(key: string, delta = 1): Promise<number> {
  const redisClient = await ensureRedisConnected();
  return redisClient.incrBy(key, delta);
}
