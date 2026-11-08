import { config } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500;

  if (status >= 500) {
    console.error(err);
  }

  const body = {
    error: status >= 500 && config.nodeEnv === 'production' ? 'Internal Server Error' : err.message,
  };
  if (err.details) body.details = err.details;

  res.status(status).json(body);
}
