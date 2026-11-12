import { promisify } from 'node:util';
import { HttpError } from '../utils/HttpError.js';
import { ensureCsrfToken, rotateCsrfToken } from '../middlewares/csrf.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../config/session.js';

const regenerate = (req) => promisify(req.session.regenerate.bind(req.session))();
const destroy = (req) => promisify(req.session.destroy.bind(req.session))();

export function createAuthController(authService) {
  return {
    csrf(req, res) {
      res.json({ csrfToken: ensureCsrfToken(req) });
    },

    // Нова сесія після входу — захист від session fixation; CSRF-токен видається заново.
    async login(req, res) {
      const user = await authService.login(req.body);
      await regenerate(req);
      req.session.user = user;
      const csrfToken = rotateCsrfToken(req);
      res.json({ user, csrfToken });
    },

    async logout(req, res) {
      await destroy(req);
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
      res.status(204).end();
    },

    async me(req, res) {
      const sessionUser = req.session.user;
      if (!sessionUser) throw HttpError.unauthorized();
      const user = await authService.getUser(sessionUser.id);
      if (!user) {
        await destroy(req);
        throw HttpError.unauthorized('Користувача більше не існує');
      }
      req.session.user = user;
      res.json({ user });
    },
  };
}
