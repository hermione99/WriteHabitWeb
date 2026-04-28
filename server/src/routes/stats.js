import { Router } from 'express';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../lib/kstDate.js';
import { prisma } from '../lib/prisma.js';

const LAUNCH_DATE = new Date(Date.UTC(2026, 3, 1));
const DAY_MS = 24 * 60 * 60 * 1000;

const serviceDays = () => {
  const today = startOfKstTodayAsUtcDate();
  return Math.max(1, Math.floor((today.getTime() - LAUNCH_DATE.getTime()) / DAY_MS) + 1);
};

export const statsRouter = Router();

statsRouter.get('/stats', async (_req, res, next) => {
  try {
    const today = startOfKstTodayAsUtcDate();
    const tomorrow = addUtcDays(today, 1);

    const [users, posts, todayPosts] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({
        where: {
          status: 'PUBLISHED',
        },
      }),
      prisma.post.count({
        where: {
          status: 'PUBLISHED',
          keyword: {
            publishDate: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
      }),
    ]);

    res.json({
      stats: {
        serviceDays: serviceDays(),
        users,
        posts,
        todayPosts,
      },
    });
  } catch (error) {
    next(error);
  }
});
