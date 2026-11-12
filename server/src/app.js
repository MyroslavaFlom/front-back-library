import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { createSessionMiddleware } from './config/session.js';
import { createApiRouter } from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { rejectMongoOperators } from './middlewares/sanitize.js';
import { csrfProtection, CSRF_HEADER } from './middlewares/csrf.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const clientIndex = fileURLToPath(new URL('../../client/dist/index.html', import.meta.url));

export const JSON_BODY_LIMIT = '100kb';

export function createApp({ services, sessionStore }) {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  // morgan перед express.json, щоб логувалися й запити з невалідним JSON.
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  // CORS лише для origin клієнта; cookie сесії дозволені (credentials).
  app.use(
    cors({
      origin: config.clientOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', CSRF_HEADER],
      exposedHeaders: ['Location'],
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createSessionMiddleware(sessionStore));

  // Порядок для /api: ліміт запитів → відсів NoSQL-операторів → CSRF → маршрути (авторизація в них).
  app.use('/api', apiLimiter, rejectMongoOperators, csrfProtection, createApiRouter(services));

  // У production віддаємо зібраний React-клієнт; усі не-/api GET-маршрути → index.html (клієнтський роутинг).
  if (config.isProduction) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(clientIndex));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
