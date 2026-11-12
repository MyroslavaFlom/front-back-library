import { Router } from 'express';

export function createReaderRoutes(controller) {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.replace);
  router.patch('/:id', controller.patch);
  router.delete('/:id', controller.remove);

  return router;
}
