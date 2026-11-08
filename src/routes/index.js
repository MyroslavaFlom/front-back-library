import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createBookRoutes } from './book.routes.js';
import { createReaderRoutes } from './reader.routes.js';
import { createBookController } from '../controllers/book.controller.js';
import { createReaderController } from '../controllers/reader.controller.js';

/**
 * Збирає роутер /api. Сервіси приходять ззовні (створюються один раз при старті).
 * @param {ReturnType<typeof import('../services/index.js').createServices>} services
 */
export function createApiRouter({ bookService, readerService }) {
  const router = Router();

  router.use('/health', healthRoutes);
  router.use('/books', createBookRoutes(createBookController(bookService)));
  router.use('/readers', createReaderRoutes(createReaderController(readerService)));

  return router;
}
