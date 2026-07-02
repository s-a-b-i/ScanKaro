import { ApiError } from '../utils/ApiError.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(ApiError.badRequest('Validation failed', parsed.error.flatten()));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(ApiError.badRequest('Invalid query parameters', parsed.error.flatten()));
      return;
    }
    req.query = parsed.data;
    next();
  };
}
