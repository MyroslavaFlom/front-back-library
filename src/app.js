import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { createApiRouter } from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

/**
 * Збирає Express-застосунок без підключення до БД і без listen.
 * @param {{ services: ReturnType<typeof import('./services/index.js').createServices> }} deps
 */
export function createApp({ services }) {
  const app = express();

  // morgan перед express.json, щоб логувалися й запити з невалідним JSON.
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(cors({ exposedHeaders: ['Location'] }));
  app.use(express.json());

  // Статичний фронтенд (public/index.html на GET /).
  app.use(express.static(publicDir));
  app.use('/api', createApiRouter(services));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
