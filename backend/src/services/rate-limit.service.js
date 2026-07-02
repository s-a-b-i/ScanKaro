import { RateLimiterRedis } from 'rate-limiter-flexible';

import { env } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

let apiUserLimiter = null;
let uploadPagesLimiter = null;
let ipFallbackLimiter = null;

function createLimiter(keyPrefix, points, durationSeconds) {
  const duration = Math.max(1, Math.floor(durationSeconds));
  return new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix,
    points: Math.max(1, Math.floor(points)),
    duration,
    // ioredis uses defineCommand (rlflxIncr). useRedisPackage: true breaks with ioredis v5.
    useRedisPackage: false,
  });
}

export function getApiUserLimiter() {
  if (!apiUserLimiter) {
    apiUserLimiter = createLimiter(
      'rl:api:user',
      env.API_RATE_LIMIT_MAX,
      Math.floor(env.API_RATE_LIMIT_WINDOW_MS / 1000),
    );
  }
  return apiUserLimiter;
}

export function getUploadPagesLimiter() {
  if (!uploadPagesLimiter) {
    uploadPagesLimiter = createLimiter(
      'rl:upload:pages',
      env.UPLOAD_PAGES_RATE_LIMIT_MAX,
      Math.floor(env.UPLOAD_PAGES_RATE_LIMIT_WINDOW_MS / 1000),
    );
  }
  return uploadPagesLimiter;
}

export function getIpFallbackLimiter() {
  if (!ipFallbackLimiter) {
    ipFallbackLimiter = createLimiter(
      'rl:ip:fallback',
      env.IP_RATE_LIMIT_MAX,
      Math.floor(env.API_RATE_LIMIT_WINDOW_MS / 1000),
    );
  }
  return ipFallbackLimiter;
}

export function formatRateLimitHeaders(result, limit) {
  return {
    'Retry-After': String(Math.ceil(result.msBeforeNext / 1000)),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remainingPoints),
    'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.msBeforeNext) / 1000)),
  };
}

export async function checkRedisForRateLimit() {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready' && client.status !== 'connect') {
      await client.connect();
    }
    await client.ping();
    return true;
  } catch (error) {
    logger.warn('rate_limit_redis_unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
