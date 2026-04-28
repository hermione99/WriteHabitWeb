import { Router } from 'express';
import { toKeywordArchiveItem, toTodayKeyword } from '../lib/keywordDto.js';
import { prisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const scheduleInclude = {
  keyword: {
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
  },
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const keywordsRouter = Router();

keywordsRouter.get('/keywords/today', async (_req, res, next) => {
  try {
    const from = startOfToday();
    const to = new Date(from.getTime() + DAY_MS);

    const schedules = await prisma.keywordSchedule.findMany({
      where: {
        startsAt: {
          gte: from,
          lt: to,
        },
        status: {
          in: ['ACTIVE', 'SCHEDULED'],
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: scheduleInclude,
    });

    const schedule = schedules.find((item) => item.status === 'ACTIVE') || schedules[0];
    if (!schedule) {
      res.status(404).json({ error: 'Today keyword not found' });
      return;
    }

    res.json({
      keyword: toTodayKeyword(schedule),
    });
  } catch (error) {
    next(error);
  }
});

keywordsRouter.get('/keywords/upcoming', async (_req, res, next) => {
  try {
    const from = startOfToday();
    const to = new Date(from.getTime() + DAY_MS * 14);

    const schedule = await prisma.keywordSchedule.findMany({
      where: {
        startsAt: {
          gte: from,
          lt: to,
        },
        status: {
          in: ['ACTIVE', 'SCHEDULED'],
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
      include: scheduleInclude,
    });

    res.json({
      keywords: schedule.map(toKeywordArchiveItem),
    });
  } catch (error) {
    next(error);
  }
});

keywordsRouter.get('/keywords/archive', async (_req, res, next) => {
  try {
    const today = startOfToday();

    const schedule = await prisma.keywordSchedule.findMany({
      where: {
        startsAt: {
          lt: today,
        },
      },
      orderBy: {
        startsAt: 'desc',
      },
      take: 60,
      include: scheduleInclude,
    });

    res.json({
      keywords: schedule.map(toKeywordArchiveItem),
    });
  } catch (error) {
    next(error);
  }
});
