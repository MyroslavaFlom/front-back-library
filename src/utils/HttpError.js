// Помилка з HTTP-статусом: кидається з сервісів/контролерів, обробляється errorHandler.
// details — довільні подробиці для клієнта, напр. [{ field, message }] для помилок валідації.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Некоректний запит', details) {
    return new HttpError(400, message, details);
  }

  static notFound(message = 'Не знайдено', details) {
    return new HttpError(404, message, details);
  }

  static conflict(message = 'Конфлікт', details) {
    return new HttpError(409, message, details);
  }

  static unprocessable(message = 'Неможливо обробити запит', details) {
    return new HttpError(422, message, details);
  }
}
