import { HttpError } from '../utils/HttpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Маршрут ${req.method} ${req.originalUrl} не знайдено`));
}
