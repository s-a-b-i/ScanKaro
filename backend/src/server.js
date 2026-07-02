import 'dotenv/config';

import { createApp } from './app.js';
import { ensureCloudinaryFolder, initCloudinary } from './config/cloudinary.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { initFirebaseAdmin } from './config/firebase.js';
import { logger } from './config/logger.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { closeOcrQueue } from './queues/ocr.queue.js';
import { startOcrWorker } from './services/ocr.service.js';

async function bootstrap() {
  initFirebaseAdmin();
  initCloudinary();
  await ensureCloudinaryFolder();
  await connectDatabase();

  try {
    await connectRedis();
    if (env.OCR_START_WORKER) {
      await startOcrWorker();
      logger.info('inline_ocr_worker_enabled');
    } else {
      logger.info('ocr_worker_disabled', { hint: 'Run npm run worker:ocr separately' });
    }
  } catch (error) {
    logger.warn('redis_ocr_unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info('server_started', { port: env.PORT, env: env.NODE_ENV });
  });

  const shutdown = async (signal) => {
    logger.info('shutdown_started', { signal });
    server.close(async () => {
      await closeOcrQueue();
      await disconnectRedis();
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('forced_shutdown');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('server_start_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
