import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, conflict } from '../lib/httpError.js';
import { recommendKeywords } from '../lib/keywordRecommendations.js';
import { toAdminKeywordSuggestion, toAdminReport, toScheduleRow } from '../lib/adminDto.js';
import { prisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const keywordScheduleSchema = z.object({
  date: z.string().trim().min(1).max(20),
  word: z.string().trim().min(1).max(40),
  eng: z.string().trim().max(80).optional().default(''),
  prompt: z.string().trim().max(500).optional().default(''),
  status: z.enum(['draft', 'scheduled', 'live', 'archived']).optional().default('scheduled'),
});

const reportStatusSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']),
});

const suggestionStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

const recommendationsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(14).optional().default(7),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body');
  }
  return result.data;
};

const parseScheduleDate = (value) => {
  const normalized = value.replace(/[./-]/g, '·');
  const [monthRaw, dayRaw] = normalized.split('·');
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!month || !day) {
    throw badRequest('Invalid date format');
  }
  return new Date(new Date().getFullYear(), month - 1, day, 0, 0, 0, 0);
};

const toKeywordStatus = (status) => {
  if (status === 'live') return 'ACTIVE';
  if (status === 'draft') return 'DRAFT';
  if (status === 'archived') return 'ARCHIVED';
  return 'SCHEDULED';
};

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

export const adminRouter = Router();

adminRouter.use('/admin', authenticate, requireAdmin);

adminRouter.get('/admin/keywords/schedule', async (_req, res, next) => {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + DAY_MS * 30);

    const schedule = await prisma.keywordSchedule.findMany({
      where: {
        startsAt: {
          gte: from,
          lt: to,
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
      include: scheduleInclude,
    });

    res.json({
      schedule: schedule.map(toScheduleRow),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/keywords/recommendations', async (req, res, next) => {
  try {
    const query = parseBody(recommendationsQuerySchema, req.query);
    const schedules = await prisma.keywordSchedule.findMany({
      orderBy: {
        startsAt: 'asc',
      },
      include: {
        keyword: true,
      },
    });

    res.json({
      recommendations: recommendKeywords({
        count: query.count,
        existingSchedules: schedules,
      }),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/keywords/suggestions', async (_req, res, next) => {
  try {
    const suggestions = await prisma.keywordSuggestion.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        user: {
          select: {
            displayName: true,
            handle: true,
          },
        },
      },
    });

    res.json({
      suggestions: suggestions.map(toAdminKeywordSuggestion),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/keywords/suggestions/:id', async (req, res, next) => {
  try {
    const body = parseBody(suggestionStatusSchema, req.body);
    const suggestion = await prisma.keywordSuggestion.update({
      where: {
        id: req.params.id,
      },
      data: {
        status: body.status.toUpperCase(),
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            displayName: true,
            handle: true,
          },
        },
      },
    });

    res.json({
      suggestion: toAdminKeywordSuggestion(suggestion),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/admin/keywords/schedule', async (req, res, next) => {
  try {
    const body = parseBody(keywordScheduleSchema, req.body);
    const startsAt = parseScheduleDate(body.date);
    const status = toKeywordStatus(body.status);

    const existingSchedule = await prisma.keywordSchedule.findUnique({
      where: {
        startsAt,
      },
      select: {
        id: true,
      },
    });

    if (existingSchedule) {
      throw conflict('Keyword already exists for this date');
    }

    const keyword = await prisma.keyword.create({
      data: {
        text: body.word,
        eng: body.eng.toUpperCase(),
        prompt: body.prompt || null,
        status,
        publishDate: startsAt,
      },
    });

    const schedule = await prisma.keywordSchedule.create({
      data: {
        keywordId: keyword.id,
        startsAt,
        status,
      },
      include: scheduleInclude,
    });

    res.status(201).json({
      schedule: toScheduleRow(schedule),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/keywords/schedule/:id', async (req, res, next) => {
  try {
    const body = parseBody(keywordScheduleSchema.partial(), req.body);
    const existing = await prisma.keywordSchedule.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        keyword: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const startsAt = body.date ? parseScheduleDate(body.date) : existing.startsAt;
    const status = body.status ? toKeywordStatus(body.status) : existing.status;

    if (startsAt.getTime() !== existing.startsAt.getTime()) {
      const dateOwner = await prisma.keywordSchedule.findUnique({
        where: {
          startsAt,
        },
        select: {
          id: true,
        },
      });

      if (dateOwner && dateOwner.id !== existing.id) {
        throw conflict('Keyword already exists for this date');
      }
    }

    await prisma.keyword.update({
      where: {
        id: existing.keywordId,
      },
      data: {
        ...(body.word !== undefined ? { text: body.word } : {}),
        ...(body.eng !== undefined ? { eng: body.eng.toUpperCase() } : {}),
        ...(body.prompt !== undefined ? { prompt: body.prompt || null } : {}),
        status,
        publishDate: startsAt,
      },
    });

    const schedule = await prisma.keywordSchedule.update({
      where: {
        id: existing.id,
      },
      data: {
        startsAt,
        status,
      },
      include: scheduleInclude,
    });

    res.json({
      schedule: toScheduleRow(schedule),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/reports', async (_req, res, next) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        post: {
          select: {
            title: true,
            status: true,
          },
        },
        reporter: {
          select: {
            handle: true,
          },
        },
      },
    });

    res.json({
      reports: reports.map(toAdminReport),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/reports/:id', async (req, res, next) => {
  try {
    const body = parseBody(reportStatusSchema, req.body);
    const nextStatus = body.status.toUpperCase();

    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { post: { select: { id: true, status: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (existing.post) {
      if (nextStatus === 'RESOLVED' && existing.post.status === 'PUBLISHED') {
        await prisma.post.update({
          where: { id: existing.post.id },
          data: { status: 'HIDDEN' },
        });
      } else if (nextStatus === 'OPEN' && existing.post.status === 'HIDDEN') {
        await prisma.post.update({
          where: { id: existing.post.id },
          data: { status: 'PUBLISHED' },
        });
      }
    }

    const report = await prisma.report.update({
      where: {
        id: req.params.id,
      },
      data: {
        status: nextStatus,
      },
      include: {
        post: {
          select: {
            title: true,
            status: true,
          },
        },
        reporter: {
          select: {
            handle: true,
          },
        },
      },
    });

    res.json({
      report: toAdminReport(report),
    });
  } catch (error) {
    next(error);
  }
});
