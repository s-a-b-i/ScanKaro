import { env } from '../config/env.js';
import {
  checkRedisForRateLimit,
  formatRateLimitHeaders,
  getApiUserLimiter,
  getIpFallbackLimiter,
  getUploadPagesLimiter,
} from '../services/rate-limit.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function resolveUserKey(req) {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`;
  }

  if (req.firebaseUser?.uid) {
    return `firebase:${req.firebaseUser.uid}`;
  }

  return `ip:${req.ip ?? 'unknown'}`;
}

async function consumeLimiter(req, res, consumePoints = 1) {
  const redisReady = await checkRedisForRateLimit();
  if (!redisReady) {
    return;
  }

  const key = resolveUserKey(req);

  try {
    const result = await getApiUserLimiter().consume(key, consumePoints);
    res.set(formatRateLimitHeaders(result, env.API_RATE_LIMIT_MAX));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    const result = error;
    res.set(formatRateLimitHeaders(result, env.API_RATE_LIMIT_MAX));
    throw ApiError.tooManyRequests(
      'API rate limit exceeded. Max 200 requests per 15 minutes.',
    );
  }
}

/** Per-user API rate limit — run after authenticate (and requireUser when available). */
export const userApiRateLimiter = asyncHandler(async (req, res, next) => {
  await consumeLimiter(req, res);
  next();
});

/** IP fallback for unauthenticated routes (health, etc.). */
export const ipFallbackRateLimiter = asyncHandler(async (req, res, next) => {
  const redisReady = await checkRedisForRateLimit();
  if (!redisReady) {
    next();
    return;
  }

  const key = `ip:${req.ip ?? 'unknown'}`;

  try {
    const result = await getIpFallbackLimiter().consume(key);
    res.set(formatRateLimitHeaders(result, env.IP_RATE_LIMIT_MAX));
    next();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    const result = error;
    res.set(formatRateLimitHeaders(result, env.IP_RATE_LIMIT_MAX));
    throw ApiError.tooManyRequests('Too many requests from this IP');
  }
});

export function uploadPagesRateLimit(getPageCount) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user?._id) {
      throw ApiError.unauthorized('Authentication required');
    }

    const pageCount = getPageCount(req);
    if (pageCount <= 0) {
      next();
      return;
    }

    const redisReady = await checkRedisForRateLimit();
    if (!redisReady) {
      next();
      return;
    }

    const key = `user:${req.user._id.toString()}`;

    try {
      const result = await getUploadPagesLimiter().consume(key, pageCount);
      res.set({
        ...formatRateLimitHeaders(result, env.UPLOAD_PAGES_RATE_LIMIT_MAX),
        'X-Upload-Pages-Remaining': String(result.remainingPoints),
      });
      next();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw ApiError.tooManyRequests(
        'Upload limit exceeded. Max 50 pages per hour per user.',
      );
    }
  });
}

/** Reject oversized Content-Length before body parsing. */
export function contentLengthGuard(maxBytes) {
  return (req, _res, next) => {
    const raw = req.headers['content-length'];
    if (!raw) {
      next();
      return;
    }

    const length = Number.parseInt(raw, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      next(ApiError.badRequest(`Request body too large. Maximum is ${maxBytes} bytes.`));
      return;
    }

    next();
  };
}
