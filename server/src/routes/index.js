import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createAuthRoutes } from './auth.routes.js';
import { createEventsRoutes } from './events.routes.js';
import { createBookRoutes } from './book.routes.js';
import { createReaderRoutes } from './reader.routes.js';
import { createLoanRoutes } from './loan.routes.js';
import { createStatsRoutes } from './stats.routes.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { createEventsController } from '../controllers/events.controller.js';
import { createBookController } from '../controllers/book.controller.js';
import { createReaderController } from '../controllers/reader.controller.js';
import { createLoanController } from '../controllers/loan.controller.js';
import { createStatsController } from '../controllers/stats.controller.js';
import { requireAdmin } from '../middlewares/auth.js';

export function createApiRouter({
  authService,
  eventService,
  bookService,
  readerService,
  loanService,
  statsService,
}) {
  const router = Router();
  const loanController = createLoanController(loanService);
  const statsController = createStatsController(statsService);

  // Публічні.
  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRoutes(createAuthController(authService)));
  router.use('/events', createEventsRoutes(createEventsController(eventService)));
  // GET — публічні, зміни — admin (перевірка в book.routes.js).
  router.use('/books', createBookRoutes(createBookController(bookService)));

  // Лише для admin.
  // Історія видач читача — підресурс читача, обслуговується контролером видач.
  router.get('/readers/:id/loans', requireAdmin, loanController.listByReader);
  // Рекомендації для читача — обчислюються сервісом аналітики.
  router.get('/readers/:id/recommendations', requireAdmin, statsController.recommendations);
  router.use('/readers', requireAdmin, createReaderRoutes(createReaderController(readerService)));
  router.use('/loans', requireAdmin, createLoanRoutes(loanController));
  router.use('/stats', requireAdmin, createStatsRoutes(statsController));

  return router;
}
