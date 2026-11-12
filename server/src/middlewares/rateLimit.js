import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../utils/HttpError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function limiter({ limit, message, ...options }) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(HttpError.tooManyRequests(message)),
    ...options,
  });
}

// Загальний ліміт для всього /api (SSE — одне довге з'єднання, тож у ліміт майже не впливає).
export const apiLimiter = limiter({ limit: 500 });

// Суворий ліміт на вхід: 5 невдалих спроб за 15 хвилин з однієї IP-адреси (успішні входи не рахуються).
export const loginLimiter = limiter({
  limit: 5,
  skipSuccessfulRequests: true,
  message: 'Забагато спроб входу. Спробуйте через 15 хвилин',
});
