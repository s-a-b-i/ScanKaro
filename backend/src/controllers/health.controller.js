import { mongoose } from '../config/database.js';
import { cloudinaryEnabled } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function checkRedis() {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export const getHealth = asyncHandler(async (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisStatus = await checkRedis();

  const healthy = mongoReady && redisStatus === 'up';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: mongoReady ? 'up' : 'down',
      redis: redisStatus,
      cloudinary: cloudinaryEnabled ? 'configured' : 'disabled',
    },
  });
});

export const getReady = asyncHandler(async (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisStatus = await checkRedis();
  const ready = mongoReady && redisStatus === 'up';

  if (!ready) {
    res.status(503).json({ success: false, ready: false });
    return;
  }

  res.json({ success: true, ready: true });
});
