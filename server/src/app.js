import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { createApiRouter } from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const clientIndex = fileURLToPath(new URL('../../client/dist/index.html', import.meta.url));

export function createApp({ services }) {
  const app = express();

  // morgan перед express.json, щоб логувалися й запити з невалідним JSON.
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(cors({ exposedHeaders: ['Location'] }));
  app.use(express.json());

  app.use('/api', createApiRouter(services));

  // У production віддаємо зібраний React-клієнт; усі не-/api GET-маршрути → index.html (клієнтський роутинг).
  if (config.nodeEnv === 'production') {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(clientIndex));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
