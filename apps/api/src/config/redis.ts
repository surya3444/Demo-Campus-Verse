import Redis from 'ioredis';
import { logger } from '../lib/logger';
import { env } from './env';

let redis: Redis;

export async function connectRedis(): Promise<Redis> {
  if (redis) return redis;

  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Disable retry limit - allows app to work without Redis
    retryStrategy(times) {
      if (times > 10) {
        logger.warn('Redis unavailable - continuing without caching');
        return null; // Stop retrying after 10 attempts
      }
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
    lazyConnect: true, // Don't connect immediately
  });

  redis.on('connect', () => {
    logger.info('Connected to Redis');
  });

  redis.on('error', (error) => {
    logger.error({ err: error }, 'Redis connection error');
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  // lazyConnect requires an explicit connect() call
  try {
    await redis.connect();
  } catch (error) {
    logger.warn({ err: error }, 'Redis initial connection failed - will retry in background');
  }

  return redis;
}

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis not initialized. Call connectRedis() first.');
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
}

export { redis };
