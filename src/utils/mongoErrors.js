import { HttpError } from './HttpError.js';

const DUPLICATE_KEY = 11000;

/**
 * Перетворює помилку унікального індексу (E11000) на 409 із назвою поля.
 * Інші помилки повертає без змін. Використання: `catch (e) { throw toConflict(e, 'Книжка') }`
 * (entityName — назва сутності українською в називному відмінку).
 */
export function toConflict(err, entityName) {
  if (err?.code !== DUPLICATE_KEY) return err;

  const field =
    Object.keys(err.keyValue ?? err.keyPattern ?? {})[0] ??
    err.message?.match(/index: (\w+?)_/)?.[1] ??
    'unknown';

  return HttpError.conflict(`${entityName} з таким значенням поля ${field} вже існує`, [
    { field, message: 'має бути унікальним' },
  ]);
}
