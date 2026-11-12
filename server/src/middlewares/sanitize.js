import { HttpError } from '../utils/HttpError.js';

const MAX_DEPTH = 20;

// Ключі з "$" (оператори MongoDB) або "." (шляхи до вкладених полів) — ознака NoSQL-ін'єкції.
const isDangerousKey = (key) => key.includes('$') || key.includes('.');

function findDangerousKey(value, path, depth = 0) {
  if (value === null || typeof value !== 'object') return null;
  if (depth > MAX_DEPTH) return path;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (!Array.isArray(value) && isDangerousKey(key)) return nestedPath;
    const found = findDangerousKey(nested, nestedPath, depth + 1);
    if (found) return found;
  }
  return null;
}

// Відхиляє запит (400), якщо body, query або params містять небезпечні ключі.
export function rejectMongoOperators(req, res, next) {
  const details = [];
  for (const source of ['body', 'query', 'params']) {
    const found = findDangerousKey(req[source], source);
    if (found) details.push({ field: found, message: 'ключі з "$" або "." заборонені' });
  }
  if (details.length > 0) return next(HttpError.badRequest('Недопустимі ключі в запиті', details));
  next();
}
