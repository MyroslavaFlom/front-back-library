import { Router } from 'express';

export function createEventsRoutes(controller) {
  const router = Router();

  router.get('/', controller.stream);

  return router;
}
