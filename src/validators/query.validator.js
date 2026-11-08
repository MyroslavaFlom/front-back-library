import { HttpError } from '../utils/HttpError.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Розбирає параметри списку з query-рядка (усі значення — рядки):
 *   page, limit — пагінація; sort — "field" або "-field" з дозволеного переліку.
 * Повертає { page, limit, skip, sort } або кидає 400.
 */
export function parseListQuery(query = {}, { sortable = [], defaultSort = { createdAt: -1 } } = {}) {
  const errors = [];

  const page = parsePositiveInt(query.page, 1);
  if (page === null) errors.push({ field: 'page', message: 'must be a positive integer' });

  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  if (limit === null || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `must be an integer between 1 and ${MAX_LIMIT}` });
  }

  let sort = defaultSort;
  if (query.sort !== undefined) {
    const raw = String(query.sort);
    const field = raw.replace(/^-/, '');
    if (!sortable.includes(field)) {
      errors.push({ field: 'sort', message: `must be one of: ${sortable.join(', ')} (prefix "-" for descending)` });
    } else {
      sort = { [field]: raw.startsWith('-') ? -1 : 1 };
    }
  }

  if (errors.length > 0) throw HttpError.badRequest('Invalid query parameters', errors);
  return { page, limit, skip: (page - 1) * limit, sort };
}

/** Необов'язковий непорожній рядковий параметр фільтра. */
export function optionalString(value) {
  if (value === undefined) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const s = String(value);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 ? n : null;
}
