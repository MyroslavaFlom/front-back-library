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
  if (yearFrom === null) errors.push({ field: 'yearFrom', message: 'має бути цілим числом' });

  const yearTo = parseInteger(query.yearTo);
  if (yearTo === null) errors.push({ field: 'yearTo', message: 'має бути цілим числом' });

  if (yearFrom != null && yearTo != null && yearFrom > yearTo) {
    errors.push({ field: 'yearFrom', message: 'має бути не більше yearTo' });
  }

  let available;
  if (query.available !== undefined) {
    const raw = String(query.available).toLowerCase();
    if (raw === 'true') available = true;
    else if (raw === 'false') available = false;
    else errors.push({ field: 'available', message: 'має бути "true" або "false"' });
  }

  throwIfErrors(errors);
  return { ...list, yearFrom: yearFrom ?? undefined, yearTo: yearTo ?? undefined, available };
}

export const LOAN_STATUS_FILTERS = ['active', 'overdue', 'returned'];

/**
 * Параметри списку видач: усе з parseListQuery плюс
 *   status   — active | overdue | returned;
 *   readerId, bookId — необов'язкові рядки (невалідний id просто нічого не знайде).
 */
export function parseLoanListQuery(query = {}, options = {}) {
  const errors = [];
  const list = collectListQuery(query, options, errors);

  let status;
  if (query.status !== undefined) {
    status = String(query.status).toLowerCase();
    if (!LOAN_STATUS_FILTERS.includes(status)) {
      errors.push({ field: 'status', message: `має бути одним із: ${LOAN_STATUS_FILTERS.join(', ')}` });
    }
  }

  throwIfErrors(errors);
  return {
    ...list,
    status,
    readerId: optionalString(query.readerId),
    bookId: optionalString(query.bookId),
  };
}

export const STATS_DEFAULT_LIMIT = 5;
export const STATS_MAX_LIMIT = 50;

const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Параметри ендпоінтів статистики й рекомендацій:
 *   limit    — ціле від 1 до 50 (за замовчуванням 5);
 *   from, to — дата (YYYY-MM-DD) або дата-час ISO 8601; from <= to.
 * Дата без часу в `to` означає «до кінця цього дня включно».
 * Повертає { limit, from?, toExclusive? } — межі періоду як Date: [from, toExclusive).
 * Для ендпоінтів без періоду передайте { period: false } — тоді from/to ігноруються.
 */
export function parseStatsQuery(query = {}, { period = true } = {}) {
  const errors = [];

  const limit = parsePositiveInt(query.limit, STATS_DEFAULT_LIMIT);
  if (limit === null || limit > STATS_MAX_LIMIT) {
    errors.push({ field: 'limit', message: `має бути цілим числом від 1 до ${STATS_MAX_LIMIT}` });
  }

  if (!period) {
    throwIfErrors(errors);
    return { limit };
  }

  const from = parseIsoDate(query.from);
  if (from === null) errors.push({ field: 'from', message: 'має бути коректною датою (YYYY-MM-DD або ISO 8601)' });

  const to = parseIsoDate(query.to);
  if (to === null) errors.push({ field: 'to', message: 'має бути коректною датою (YYYY-MM-DD або ISO 8601)' });

  if (from && to && from.date > to.date) {
    errors.push({ field: 'from', message: 'має бути не пізніше за to' });
  }

  throwIfErrors(errors);
  return {
    limit,
    from: from?.date,
    // Лише дата — включаємо весь день: межа = початок наступного дня (UTC).
    toExclusive: to ? (to.dateOnly ? new Date(to.date.getTime() + DAY_MS) : new Date(to.date.getTime() + 1)) : undefined,
  };
}

/**
 * undefined/'' → undefined; невалідне → null; інакше { date, dateOnly }.
 * Сувора перевірка: календарно неможливі дати (2026-02-30) відхиляються,
 * хоча new Date() мовчки перетворив би їх на 2 березня.
 */
function parseIsoDate(value) {
  if (value === undefined || value === '') return undefined;
  const s = String(value).trim();
  const m = ISO_DATE_RE.exec(s);
  if (!m) return null;

  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  if (Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59) return null;

  const dateOnly = m[4] === undefined;
  // Дата без часу трактується як UTC-північ (як і new Date('YYYY-MM-DD')).
  const date = new Date(dateOnly ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(date.getTime())) return null;
  return { date, dateOnly };
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
  if (page === null) errors.push({ field: 'page', message: 'має бути додатним цілим числом' });

  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  if (limit === null || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `має бути цілим числом від 1 до ${MAX_LIMIT}` });
  }

  let sort = defaultSort;
  if (query.sort !== undefined) {
    const raw = String(query.sort);
    const field = raw.replace(/^-/, '');
    if (!sortable.includes(field)) {
      errors.push({ field: 'sort', message: `має бути одним із: ${sortable.join(', ')} (префікс "-" — за спаданням)` });
    } else {
      sort = { [field]: raw.startsWith('-') ? -1 : 1 };
    }
  }

  return { page, limit, skip: (page - 1) * limit, sort };
}

function throwIfErrors(errors) {
  if (errors.length > 0) throw HttpError.badRequest('Некоректні параметри запиту', errors);
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
