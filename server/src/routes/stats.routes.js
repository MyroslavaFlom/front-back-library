import { Router } from 'express';

export function createStatsRoutes(controller) {
  const router = Router();

  router.get('/popular-books', controller.popularBooks);
  router.get('/genres', controller.genres);
  router.get('/overdue', controller.overdue);
  router.get('/top-readers', controller.topReaders);
  router.get('/summary', controller.summary);

  return router;
}
