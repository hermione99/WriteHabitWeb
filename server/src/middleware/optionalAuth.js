import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/auth.js';

export const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.get('authorization');
    const [scheme, token] = header ? header.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    next();
  } catch {
    next();
  }
};
