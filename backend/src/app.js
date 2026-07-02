import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env, corsOrigins } from './config/env.js';
import { getHealth } from './controllers/health.controller.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { contentLengthGuard, ipFallbackRateLimiter } from './middleware/userRateLimit.middleware.js';
import routes from './routes/index.js';

function parseLimitBytes(limit) {
  const match = /^(\d+(?:\.\d+)?)(kb|mb|gb)?$/i.exec(limit.trim());
  if (!match) return 1024 * 1024;

  const value = Number.parseFloat(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();

  switch (unit) {
    case 'gb':
      return Math.floor(value * 1024 * 1024 * 1024);
    case 'mb':
      return Math.floor(value * 1024 * 1024);
    case 'kb':
      return Math.floor(value * 1024);
    default:
      return Math.floor(value);
  }
}

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: corsOrigins !== '*',
    }),
  );
  app.use(compression());
  app.use(requestLogger);

  const jsonLimitBytes = parseLimitBytes(env.REQUEST_JSON_LIMIT);
  app.use(contentLengthGuard(jsonLimitBytes));
  app.use(express.json({ limit: env.REQUEST_JSON_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_URLENCODED_LIMIT }));

  app.get('/health', getHealth);

  app.use('/api', ipFallbackRateLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
