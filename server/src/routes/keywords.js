import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';
import { toKeywordArchiveItem, toTodayKeyword } from '../lib/keywordDto.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../lib/kstDate.js';
import { prisma } from '../lib/prisma.js';

const scheduleInclude = {
  keyword: {
    include: {
      _count: {
        select: {
          posts: {
            where: {
              status: 'PUBLISHED',
            },
          },
        },
      },
    },
  },
};

const suggestionSchema = z.object({
  word: z.string().trim().min(1).max(40),
  eng: z.string().trim().max(80).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body');
  }
  return result.data;
};

export const keywordsRouter = Router();

keywordsRouter.get('/keywords/today', async (_req, res, next) => {
  try {
    const from = startOfKstTodayAsUtcDate();
    const to = addUtcDays(from, 1);

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
    const from = startOfKstTodayAsUtcDate();
    const to = addUtcDays(from, 14);

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
    const today = startOfKstTodayAsUtcDate();

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

keywordsRouter.post('/keywords/suggestions', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(suggestionSchema, req.body);

    const suggestion = await prisma.keywordSuggestion.create({
      data: {
        userId: req.user.id,
        word: body.word,
        eng: body.eng ? body.eng.toUpperCase() : null,
        note: body.note || null,
      },
    });

    res.status(201).json({
      suggestion: {
        id: suggestion.id,
        word: suggestion.word,
        eng: suggestion.eng || '',
        note: suggestion.note || '',
        status: suggestion.status.toLowerCase(),
        createdAt: suggestion.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
