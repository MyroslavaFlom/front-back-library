import { Router } from 'express';
import { loginLimiter } from '../middlewares/rateLimit.js';

export function createAuthRoutes(controller) {
  const router = Router();

  router.get('/csrf', controller.csrf);
  router.post('/login', loginLimiter, controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', controller.me);

  return router;
}
