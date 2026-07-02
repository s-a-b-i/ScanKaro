import Redis from 'ioredis';

import { env } from './env.js';
import { logger } from './logger.js';

let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (error) => {
      logger.error('redis_connection_error', { message: error.message });
    });

    redisClient.on('connect', () => {
      logger.info('redis_connected');
    });
  }

  return redisClient;
}

export async function connectRedis() {
  const client = getRedisClient();
  if (client.status === 'ready') return;
  await client.connect();
}

export async function disconnectRedis() {
  if (!redisClient) return;
  await redisClient.quit();
  redisClient = null;
}
