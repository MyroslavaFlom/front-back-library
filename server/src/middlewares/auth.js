import { HttpError } from '../utils/HttpError.js';

// Без входу → 401.
export function requireAuth(req, res, next) {
  if (!req.session?.user) return next(HttpError.unauthorized());
  next();
}

// Без потрібної ролі → 403 (без входу — 401).
export function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return next(HttpError.unauthorized());
    if (!roles.includes(user.role)) return next(HttpError.forbidden());
    next();
  };
}

export const requireAdmin = requireRole('admin');
