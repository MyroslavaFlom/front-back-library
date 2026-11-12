import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.js';

// Читання каталогу — публічне; зміни — лише для admin.
export function createBookRoutes(controller) {
  const router = Router();

  router.get('/', controller.list);
  // До /:id, інакше "genres" сприймався б як id.
  router.get('/genres', controller.genres);
  router.get('/:id', controller.getById);
  router.post('/', requireAdmin, controller.create);
  router.put('/:id', requireAdmin, controller.replace);
  router.patch('/:id', requireAdmin, controller.patch);
  router.delete('/:id', requireAdmin, controller.remove);

  return router;
}
