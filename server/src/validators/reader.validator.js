import { validate } from './validate.js';

// Прагматична перевірка: local@domain.tld, без пробілів; повна RFC 5322 тут надмірна.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Міжнародний формат: необов'язковий +, цифри, пробіли, дужки, дефіси; 7–15 цифр.
const PHONE_RE = /^\+?[\d\s()-]+$/;

const readerSchema = {
  name: { type: 'string', required: true, max: 200 },
  email: {
    type: 'string',
    required: true,
    max: 254,
    check: (v) => (EMAIL_RE.test(v) ? undefined : 'має бути коректною адресою електронної пошти'),
    normalize: (v) => v.toLowerCase(),
  },
  phone: {
    type: 'string',
    check: (v) => {
      const digits = v.replace(/\D/g, '').length;
      return PHONE_RE.test(v) && digits >= 7 && digits <= 15
        ? undefined
        : 'має бути коректним номером телефону (7–15 цифр, необов\'язковий + на початку)';
    },
  },
  registeredAt: {
    type: 'date',
    check: (v) => (v.getTime() > Date.now() ? 'не може бути в майбутньому' : undefined),
  },
};

export function validateReader(input) {
  return validate(readerSchema, input);
}

export function validateReaderPatch(input) {
  return validate(readerSchema, input, { partial: true });
}
