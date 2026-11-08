import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createBookRoutes } from './book.routes.js';
import { createReaderRoutes } from './reader.routes.js';
import { createLoanRoutes } from './loan.routes.js';
import { createBookController } from '../controllers/book.controller.js';
import { createReaderController } from '../controllers/reader.controller.js';
import { createLoanController } from '../controllers/loan.controller.js';

/**
 * Збирає роутер /api. Сервіси приходять ззовні (створюються один раз при старті).
 * @param {ReturnType<typeof import('../services/index.js').createServices>} services
 */
export function createApiRouter({ bookService, readerService, loanService }) {
  const router = Router();
  const loanController = createLoanController(loanService);

  router.use('/health', healthRoutes);
  router.use('/books', createBookRoutes(createBookController(bookService)));
  // Історія видач читача — підресурс читача, обслуговується контролером видач.
  router.get('/readers/:id/loans', loanController.listByReader);
  router.use('/readers', createReaderRoutes(createReaderController(readerService)));
  router.use('/loans', createLoanRoutes(loanController));

  return router;
}
