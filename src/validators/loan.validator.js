import { validate } from './validate.js';

export const MIN_LOAN_DAYS = 1;
export const MAX_LOAN_DAYS = 30;

const baseSchema = {
  bookId: { type: 'string', required: true },
  readerId: { type: 'string', required: true },
  days: { type: 'integer', min: MIN_LOAN_DAYS, max: MAX_LOAN_DAYS },
};

// loanDate (дата видачі в минулому) — лише для тестування прострочень поза production.
const backdatedSchema = {
  ...baseSchema,
  loanDate: {
    type: 'date',
    check: (v) => (v.getTime() > Date.now() ? 'must not be in the future' : undefined),
  },
};

/**
 * Тіло POST /api/loans: { bookId, readerId, days?, loanDate? }.
 * Якщо allowLoanDate = false, поле loanDate відхиляється як невідоме (400).
 */
export function validateLoanCreate(input, { allowLoanDate = false } = {}) {
  return validate(allowLoanDate ? backdatedSchema : baseSchema, input);
}
