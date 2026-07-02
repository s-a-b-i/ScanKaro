import { getRedisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export class CacheService {
  static foldersKey(userId) {
    return `cache:folders:${userId}`;
  }

  static userProfileKey(userId) {
    return `cache:user:${userId}`;
  }

  static async get(key) {
    try {
      const client = getRedisClient();
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      logger.warn('cache_get_failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  static async set(key, value, ttlSeconds) {
    try {
      const client = getRedisClient();
      const ttl = Math.max(1, Math.floor(ttlSeconds));
      await client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      logger.warn('cache_set_failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async del(...keys) {
    if (keys.length === 0) return;

    try {
      const client = getRedisClient();
      await client.del(...keys);
    } catch (error) {
      logger.warn('cache_del_failed', {
        keys,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async invalidateFolders(userId) {
    await CacheService.del(CacheService.foldersKey(userId));
  }

  static async invalidateUserProfile(userId) {
    await CacheService.del(CacheService.userProfileKey(userId));
  }

  static folderTtlSeconds = env.CACHE_TTL_FOLDERS_SECONDS;
  static userProfileTtlSeconds = env.CACHE_TTL_USER_PROFILE_SECONDS;
}
