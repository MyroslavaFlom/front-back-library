import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createBookRoutes } from './book.routes.js';
import { createReaderRoutes } from './reader.routes.js';
import { createLoanRoutes } from './loan.routes.js';
import { createStatsRoutes } from './stats.routes.js';
import { createBookController } from '../controllers/book.controller.js';
import { createReaderController } from '../controllers/reader.controller.js';
import { createLoanController } from '../controllers/loan.controller.js';
import { createStatsController } from '../controllers/stats.controller.js';

export function createApiRouter({ bookService, readerService, loanService, statsService }) {
  const router = Router();
  const loanController = createLoanController(loanService);
  const statsController = createStatsController(statsService);

  router.use('/health', healthRoutes);
  router.use('/books', createBookRoutes(createBookController(bookService)));
  // Історія видач читача — підресурс читача, обслуговується контролером видач.
  router.get('/readers/:id/loans', loanController.listByReader);
  // Рекомендації для читача — обчислюються сервісом аналітики.
  router.get('/readers/:id/recommendations', statsController.recommendations);
  router.use('/readers', createReaderRoutes(createReaderController(readerService)));
  router.use('/loans', createLoanRoutes(loanController));
  router.use('/stats', createStatsRoutes(statsController));

  return router;
}
