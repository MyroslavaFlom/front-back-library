import { HttpError } from '../utils/HttpError.js';

/**
 * Мінімалістичний декларативний валідатор.
 *
 * Схема — об'єкт { field: rule }, де rule:
 *   type:      'string' | 'integer' | 'number' | 'date'
 *   required:  boolean           — обов'язкове при створенні / PUT
 *   min, max:  number | () => number — для чисел значення, для рядків довжина
 *   check:     (value) => string | undefined — додаткова перевірка, повертає текст помилки
 *   normalize: (value) => value  — нормалізація після успішної перевірки
 *
 * Повертає нормалізовані дані або кидає HttpError 400 з details: [{ field, message }].
 */
export function validate(schema, input, { partial = false, crossCheck } = {}) {
  if (!isPlainObject(input)) {
    throw HttpError.badRequest('Validation failed', [
      { field: 'body', message: 'must be a JSON object' },
    ]);
  }

  const errors = [];
  const value = {};

  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(schema, key)) errors.push({ field: key, message: 'is not allowed' });
  }

  if (partial && Object.keys(input).length === 0) {
    errors.push({ field: 'body', message: 'must contain at least one field' });
  }

  for (const [field, rule] of Object.entries(schema)) {
    const raw = input[field];
    if (raw === undefined) {
      if (rule.required && !partial) errors.push({ field, message: 'is required' });
      continue;
    }
    const result = checkField(rule, raw);
    if (result.error) errors.push({ field, message: result.error });
    else value[field] = result.value;
  }

  if (errors.length === 0 && crossCheck) {
    errors.push(...crossCheck(value));
  }

  if (errors.length > 0) {
    throw HttpError.badRequest('Validation failed', errors);
  }
  return value;
}

const resolve = (bound) => (typeof bound === 'function' ? bound() : bound);

function checkField(rule, raw) {
  let value;
  const min = resolve(rule.min);
  const max = resolve(rule.max);

  switch (rule.type) {
    case 'string': {
      if (typeof raw !== 'string') return { error: 'must be a string' };
      value = raw.trim();
      if (rule.required && value.length === 0) return { error: 'must not be empty' };
      if (min !== undefined && value.length < min) return { error: `must be at least ${min} characters long` };
      if (max !== undefined && value.length > max) return { error: `must be at most ${max} characters long` };
      break;
    }
    case 'integer':
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: 'must be a number' };
      if (rule.type === 'integer' && !Number.isInteger(raw)) return { error: 'must be an integer' };
      if (min !== undefined && raw < min) return { error: `must be >= ${min}` };
      if (max !== undefined && raw > max) return { error: `must be <= ${max}` };
      value = raw;
      break;
    }
    case 'date': {
      const date = raw instanceof Date ? raw : typeof raw === 'string' ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) return { error: 'must be a valid ISO 8601 date' };
      value = date;
      break;
    }
    default:
      throw new Error(`Unknown rule type: ${rule.type}`);
  }

  const error = rule.check?.(value);
  if (error) return { error };
  return { value: rule.normalize ? rule.normalize(value) : value };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}
