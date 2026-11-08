import { HttpError } from '../utils/HttpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
}
