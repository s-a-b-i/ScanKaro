import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { closeOcrQueue } from './queues/ocr.queue.js';
import { startOcrWorker } from './services/ocr.service.js';

async function bootstrap() {
  await connectRedis();
  await connectDatabase();
  await startOcrWorker();

  logger.info('ocr_worker_started', {
    env: env.NODE_ENV,
    concurrency: env.OCR_QUEUE_CONCURRENCY,
  });

  const shutdown = async (signal) => {
    logger.info('ocr_worker_shutdown', { signal });
    await closeOcrQueue();
    await disconnectRedis();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('ocr_worker_start_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
