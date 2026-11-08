import { Router } from 'express';

/** @param {ReturnType<typeof import('../controllers/loan.controller.js').createLoanController>} controller */
export function createLoanRoutes(controller) {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  // Дії над ресурсом (не CRUD) — окремі POST-підресурси.
  router.post('/:id/return', controller.returnLoan);
  router.post('/:id/extend', controller.extend);

  return router;
}
