import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../lib/httpError.js';
import { verifyAccessToken } from '../lib/auth.js';

export const authenticate = async (req, _res, next) => {
  try {
    const header = req.get('authorization');
    const [scheme, token] = header ? header.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
      throw unauthorized('Missing bearer token');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw unauthorized('User no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.status) {
      next(error);
      return;
    }
    next(unauthorized('Invalid or expired token'));
  }
};
