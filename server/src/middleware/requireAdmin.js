import { unauthorized } from '../lib/httpError.js';

export const requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') {
    next(unauthorized('Admin access required'));
    return;
  }
  next();
};
