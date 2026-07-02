import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let details;
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
    isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.flatten();
    isOperational = true;
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (!isOperational) {
    logger.error('unhandled_error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?._id?.toString(),
    });
  } else if (statusCode >= 500) {
    logger.warn('operational_error', { statusCode, message, url: req.originalUrl });
  }

  const body = {
    success: false,
    message,
  };

  if (details !== undefined) {
    body.details = details;
  }

  if (!isProduction && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
