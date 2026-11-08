import { HttpError } from '../utils/HttpError.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Розбирає параметри списку з query-рядка (усі значення — рядки):
 *   page, limit — пагінація; sort — "field" або "-field" з дозволеного переліку.
 * Повертає { page, limit, skip, sort } або кидає 400.
 */
export function parseListQuery(query = {}, options = {}) {
  const errors = [];
  const result = collectListQuery(query, options, errors);
  throwIfErrors(errors);
  return result;
}

/**
 * Параметри списку книжок: усе з parseListQuery плюс
 *   yearFrom, yearTo — цілі числа, yearFrom <= yearTo;
 *   available        — "true" (availableCopies > 0) або "false" (availableCopies = 0).
 * Помилки всіх параметрів збираються разом в одну 400-відповідь.
 */
export function parseBookListQuery(query = {}, options = {}) {
  const errors = [];
  const list = collectListQuery(query, options, errors);

  const yearFrom = parseInteger(query.yearFrom);
  if (yearFrom === null) errors.push({ field: 'yearFrom', message: 'must be an integer' });

  const yearTo = parseInteger(query.yearTo);
  if (yearTo === null) errors.push({ field: 'yearTo', message: 'must be an integer' });

  if (yearFrom != null && yearTo != null && yearFrom > yearTo) {
    errors.push({ field: 'yearFrom', message: 'must be <= yearTo' });
  }

  let available;
  if (query.available !== undefined) {
    const raw = String(query.available).toLowerCase();
    if (raw === 'true') available = true;
    else if (raw === 'false') available = false;
    else errors.push({ field: 'available', message: 'must be "true" or "false"' });
  }

  throwIfErrors(errors);
  return { ...list, yearFrom: yearFrom ?? undefined, yearTo: yearTo ?? undefined, available };
}

export function totalPages(total, limit) {
  return Math.ceil(total / limit);
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

function collectListQuery(query, { sortable = [], defaultSort = { createdAt: -1 } }, errors) {
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

  return { page, limit, skip: (page - 1) * limit, sort };
}

function throwIfErrors(errors) {
  if (errors.length > 0) throw HttpError.badRequest('Invalid query parameters', errors);
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const s = String(value);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 ? n : null;
}

/** undefined/'' → undefined; невалідне → null; інакше ціле число (допускається від'ємне). */
function parseInteger(value) {
  if (value === undefined || value === '') return undefined;
  const s = String(value).trim();
  return /^-?\d+$/.test(s) ? Number(s) : null;
}
