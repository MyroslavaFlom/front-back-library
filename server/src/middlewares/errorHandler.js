import { HttpError } from '../utils/HttpError.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, message, details } = normalize(err);

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: { status, message, details: details ?? null } });
}

const BODY_PARSER_MESSAGES = Object.freeze({
  'entity.parse.failed': 'Некоректний JSON у тілі запиту',
  'entity.too.large': 'Тіло запиту завелике',
  'entity.verify.failed': 'Тіло запиту не пройшло перевірку',
  'encoding.unsupported': 'Непідтримуване кодування тіла запиту',
  'charset.unsupported': 'Непідтримуване кодування символів тіла запиту',
  'parameters.too.many': 'Забагато параметрів у тілі запиту',
  'request.aborted': 'Запит перервано клієнтом',
  'request.size.invalid': 'Розмір тіла запиту не відповідає заголовку Content-Length',
  'stream.encoding.set': 'Некоректний стан потоку запиту',
});

function normalize(err) {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message, details: err.details };
  }

  // Невалідний JSON у тілі запиту (express.json / body-parser).
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, message: BODY_PARSER_MESSAGES[err.type] };
  }

  // Інші клієнтські помилки body-parser (занадто велике тіло, невідоме кодування тощо).
  if (err?.expose && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return { status: err.status, message: BODY_PARSER_MESSAGES[err.type] ?? 'Некоректний запит' };
  }

  return { status: 500, message: 'Внутрішня помилка сервера' };
}
