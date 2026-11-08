// Помилка з HTTP-статусом: кидається з сервісів/контролерів, обробляється errorHandler.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}
