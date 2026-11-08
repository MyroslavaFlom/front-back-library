import { validate } from './validate.js';

const currentYear = () => new Date().getFullYear();

/** Прибирає дефіси/пробіли й перевіряє контрольну суму ISBN-10 або ISBN-13. */
export function normalizeIsbn(value) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce(
      (acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i),
      0,
    );
    return sum % 11 === 0;
  }

  if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }

  return false;
}

const bookSchema = {
  title: { type: 'string', required: true, max: 500 },
  author: { type: 'string', required: true, max: 300 },
  isbn: {
    type: 'string',
    required: true,
    check: (v) => (isValidIsbn(v) ? undefined : 'має бути коректним ISBN-10 або ISBN-13'),
    normalize: normalizeIsbn,
  },
  genre: { type: 'string', min: 1, max: 100 },
  year: { type: 'integer', max: currentYear },
  pages: { type: 'integer', min: 1 },
  totalCopies: { type: 'integer', required: true, min: 0 },
  availableCopies: { type: 'integer', min: 0 },
  rating: { type: 'number', min: 0, max: 5 },
};

function crossCheck({ totalCopies, availableCopies }) {
  if (totalCopies !== undefined && availableCopies !== undefined && availableCopies > totalCopies) {
    return [{ field: 'availableCopies', message: 'має бути не більше totalCopies' }];
  }
  return [];
}

/** Повна валідація (POST / PUT). */
export function validateBook(input) {
  return validate(bookSchema, input, { crossCheck });
}

/** Часткова валідація (PATCH): перевіряються лише передані поля. */
export function validateBookPatch(input) {
  return validate(bookSchema, input, { partial: true, crossCheck });
}
