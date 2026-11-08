// Помилка з HTTP-статусом: кидається з сервісів/контролерів, обробляється errorHandler.
// details — довільні подробиці для клієнта, напр. [{ field, message }] для помилок валідації.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Bad Request', details) {
    return new HttpError(400, message, details);
  }

  static notFound(message = 'Not Found', details) {
    return new HttpError(404, message, details);
  }

  static conflict(message = 'Conflict', details) {
    return new HttpError(409, message, details);
  }

  static unprocessable(message = 'Unprocessable Entity', details) {
    return new HttpError(422, message, details);
  }
}
