import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/HttpError.js';

export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Synchronizer token: токен зберігається в сесії; клієнт отримує його з GET /api/auth/csrf.
export function ensureCsrfToken(req) {
  req.session.csrfToken ??= randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

// Новий токен (після login — сесію регенеровано, старий токен зник разом з нею).
export function rotateCsrfToken(req) {
  req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function tokensMatch(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Змінювальні запити (POST/PUT/PATCH/DELETE) мають містити заголовок X-CSRF-Token.
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!tokensMatch(req.session?.csrfToken, req.get(CSRF_HEADER))) {
    return next(HttpError.forbidden('Відсутній або недійсний CSRF-токен (заголовок X-CSRF-Token)'));
  }
  next();
}
