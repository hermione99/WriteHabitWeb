import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';
import { addUtcDays, getUtcDateParts, startOfKstTodayAsUtcDate, utcDateFromParts } from '../lib/kstDate.js';
import { prisma } from '../lib/prisma.js';

const LAUNCH_DATE = new Date(Date.UTC(2026, 3, 1));
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, '0');

const parseYearMonth = (query) => {
  const today = startOfKstTodayAsUtcDate();
  const todayParts = getUtcDateParts(today);
  const year = query.year === undefined ? todayParts.year : Number(query.year);
  const month = query.month === undefined ? todayParts.month + 1 : Number(query.month);

  if (!Number.isInteger(year) || year < 2026 || year > 2100) {
    throw badRequest('Invalid year');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw badRequest('Invalid month');
  }

  return { year, month };
};

const dayKey = (date) => Math.floor(date.getTime() / DAY_MS);

const formatDateStr = (date) => {
  const parts = getUtcDateParts(date);
  return `${parts.year}·${pad2(parts.month + 1)}·${pad2(parts.day)}`;
};

const formatKeywordNo = (date) => {
  const dayNum = dayKey(date) - dayKey(LAUNCH_DATE) + 1;
  return String(Math.max(1, dayNum)).padStart(4, '0');
};

const toKeyword = (schedule) =>
  schedule
    ? {
        id: schedule.keywordId,
        scheduleId: schedule.id,
        word: schedule.keyword?.text || '',
        eng: schedule.keyword?.eng || '',
        no: formatKeywordNo(schedule.startsAt),
      }
    : null;

const buildStreakSummary = (scheduledDays, writtenDays, todayKey) => {
  let current = 0;
  while (writtenDays.has(todayKey - current)) current += 1;

  let longest = 0;
  let running = 0;
  scheduledDays.forEach((key) => {
    if (key > todayKey) return;
    if (writtenDays.has(key)) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  });

  return {
    current,
    longest,
    writtenDays: writtenDays.size,
  };
};

const makeStreakLabels = (period, today = new Date()) => {
  const count = Number(period);
  const start = addUtcDays(startOfKstTodayAsUtcDate(today), -(count - 1));
  const points = [0, 0.17, 0.34, 0.51, 0.68, 0.85, 1].map((ratio) =>
    addUtcDays(start, Math.min(count - 1, Math.round((count - 1) * ratio))),
  );

  return points.map((date, index) => {
    if (index === points.length - 1) return '오늘';
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${month}·${day}`;
  });
};

const buildProfileStreak = (posts, today = new Date()) => {
  const activeDays = new Set(posts.map((post) => dayKey(startOfKstTodayAsUtcDate(post.createdAt))));
  const todayKey = dayKey(startOfKstTodayAsUtcDate(today));
  let current = 0;
  while (activeDays.has(todayKey - current)) current += 1;

  return {
    current,
    completedToday: activeDays.has(todayKey),
    activity: {
      30: Array.from({ length: 30 }, (_, index) => activeDays.has(todayKey - 29 + index)),
      90: Array.from({ length: 90 }, (_, index) => activeDays.has(todayKey - 89 + index)),
      365: Array.from({ length: 365 }, (_, index) => activeDays.has(todayKey - 364 + index)),
    },
  };
};

export const streaksRouter = Router();

streaksRouter.get('/streaks/me/summary', authenticate, async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: req.user.id,
        status: 'PUBLISHED',
      },
      select: {
        createdAt: true,
      },
    });

    res.json({
      streak: buildProfileStreak(posts),
      labels: {
        30: makeStreakLabels(30),
        90: makeStreakLabels(90),
        365: makeStreakLabels(365),
      },
    });
  } catch (error) {
    next(error);
  }
});

streaksRouter.get('/streaks/me', authenticate, async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.query);
    const monthStart = utcDateFromParts({ year, month: month - 1, day: 1 });
    const monthEnd = utcDateFromParts({ year, month, day: 1 });
    const today = startOfKstTodayAsUtcDate();
    const todayKey = dayKey(today);

    const [monthSchedules, allSchedules, userPosts] = await Promise.all([
      prisma.keywordSchedule.findMany({
        where: {
          startsAt: {
            gte: monthStart,
            lt: monthEnd,
          },
          status: {
            in: ['ACTIVE', 'SCHEDULED', 'ARCHIVED'],
          },
        },
        orderBy: {
          startsAt: 'asc',
        },
        include: {
          keyword: true,
        },
      }),
      prisma.keywordSchedule.findMany({
        where: {
          startsAt: {
            gte: LAUNCH_DATE,
            lte: today,
          },
          status: {
            in: ['ACTIVE', 'SCHEDULED', 'ARCHIVED'],
          },
        },
        orderBy: {
          startsAt: 'asc',
        },
        select: {
          keywordId: true,
          startsAt: true,
        },
      }),
      prisma.post.findMany({
        where: {
          authorId: req.user.id,
          status: 'PUBLISHED',
          keywordId: {
            not: null,
          },
        },
        select: {
          keywordId: true,
        },
      }),
    ]);

    const scheduleByKey = new Map(monthSchedules.map((schedule) => [dayKey(schedule.startsAt), schedule]));
    const allScheduleKeys = allSchedules.map((schedule) => dayKey(schedule.startsAt));
    const scheduleKeyByKeywordId = new Map(allSchedules.map((schedule) => [schedule.keywordId, dayKey(schedule.startsAt)]));
    const writtenDays = new Set(
      userPosts
        .map((post) => scheduleKeyByKeywordId.get(post.keywordId))
        .filter((key) => key !== undefined && key <= todayKey)
    );
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = addUtcDays(monthStart, index);
      const key = dayKey(date);
      const schedule = scheduleByKey.get(key);
      const written = writtenDays.has(key);
      const isToday = key === todayKey;
      const isFuture = key > todayKey;
      const hasKeyword = Boolean(schedule);
      const status = isFuture
        ? 'future'
        : isToday
          ? 'today'
          : written
            ? 'written'
            : hasKeyword
              ? 'missed'
              : 'none';

      return {
        date: formatDateStr(date),
        day: index + 1,
        status,
        written,
        hasKeyword,
        keyword: toKeyword(schedule),
      };
    });

    res.json({
      streak: {
        year,
        month: pad2(month),
        ...buildStreakSummary(allScheduleKeys, writtenDays, todayKey),
        days,
      },
    });
  } catch (error) {
    next(error);
  }
});
