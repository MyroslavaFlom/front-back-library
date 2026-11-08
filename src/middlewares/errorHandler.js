import { HttpError } from '../utils/HttpError.js';

/**
 * Єдиний формат відповіді з помилкою:
 *   { "error": { "status": 400, "message": "...", "details": [...] | null } }
 * Стек ніколи не потрапляє у відповідь — лише в лог для 5xx.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, message, details } = normalize(err);

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: { status, message, details: details ?? null } });
}

function normalize(err) {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message, details: err.details };
  }

  // Невалідний JSON у тілі запиту (express.json / body-parser).
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, message: 'Malformed JSON in request body' };
  }

  // Інші клієнтські помилки body-parser (занадто велике тіло, невідоме кодування тощо).
  if (err?.expose && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return { status: err.status, message: err.message };
  }

  return { status: 500, message: 'Internal Server Error' };
}
