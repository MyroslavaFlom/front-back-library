import { HttpError } from '../utils/HttpError.js';

export function validate(schema, input, { partial = false, crossCheck } = {}) {
  if (!isPlainObject(input)) {
    throw HttpError.badRequest('Помилка валідації', [
      { field: 'body', message: "має бути JSON-об'єктом" },
    ]);
  }

  const errors = [];
  const value = {};

  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(schema, key)) errors.push({ field: key, message: 'недопустиме поле' });
  }

  if (partial && Object.keys(input).length === 0) {
    errors.push({ field: 'body', message: 'має містити принаймні одне поле' });
  }

  for (const [field, rule] of Object.entries(schema)) {
    const raw = input[field];
    if (raw === undefined) {
      if (rule.required && !partial) errors.push({ field, message: "обов'язкове поле" });
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
    throw HttpError.badRequest('Помилка валідації', errors);
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
      if (typeof raw !== 'string') return { error: 'має бути рядком' };
      value = raw.trim();
      if (rule.required && value.length === 0) return { error: 'не може бути порожнім' };
      if (min !== undefined && value.length < min) return { error: `мінімальна довжина — ${min}` };
      if (max !== undefined && value.length > max) return { error: `максимальна довжина — ${max}` };
      break;
    }
    case 'integer':
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: 'має бути числом' };
      if (rule.type === 'integer' && !Number.isInteger(raw)) return { error: 'має бути цілим числом' };
      if (min !== undefined && raw < min) return { error: `має бути не менше ${min}` };
      if (max !== undefined && raw > max) return { error: `має бути не більше ${max}` };
      value = raw;
      break;
    }
    case 'date': {
      const date = raw instanceof Date ? raw : typeof raw === 'string' ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) return { error: 'має бути коректною датою у форматі ISO 8601' };
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
