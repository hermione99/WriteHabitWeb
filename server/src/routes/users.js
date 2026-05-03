import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest, conflict } from '../lib/httpError.js';
import { isReservedHandle, normalizeHandle } from '../lib/handles.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../lib/kstDate.js';
import { prisma } from '../lib/prisma.js';
import { toPublicPost } from '../lib/postDto.js';
import { toPublicUser } from '../lib/userDto.js';

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  handle: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  bio: z.string().trim().max(120).optional().nullable(),
  avatarUrl: z.string().trim().url().max(1000).optional().nullable(),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body');
  }
  return result.data;
};

const postInclude = {
  author: true,
  keyword: true,
  likes: {
    select: {
      userId: true,
    },
  },
  bookmarks: {
    select: {
      userId: true,
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
      bookmarks: true,
    },
  },
};

const formatProfileUser = (user) => ({
  id: user.id,
  name: user.displayName,
  handle: user.handle,
  bio: user.bio || '',
  avatarUrl: user.avatarUrl || null,
  initial: user.displayName?.[0] || '?',
});

const kstDayKey = (date) => Math.floor(startOfKstTodayAsUtcDate(date).getTime() / 86400000);

const buildStreak = (posts, today = new Date()) => {
  const activeDays = new Set(posts.map((post) => kstDayKey(post.createdAt)));
  const todayKey = kstDayKey(today);
  let current = 0;
  while (activeDays.has(todayKey - current)) current += 1;

  const activity = {
    30: Array.from({ length: 30 }, (_, index) => activeDays.has(todayKey - 29 + index)),
    90: Array.from({ length: 90 }, (_, index) => activeDays.has(todayKey - 89 + index)),
    365: Array.from({ length: 365 }, (_, index) => activeDays.has(todayKey - 364 + index)),
  };

  return {
    current,
    completedToday: activeDays.has(todayKey),
    activity,
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

const STREAK_WINDOW_DAYS = 365;

const makeProfileDetails = async (user, viewer = null, { includePrivate = false, includeStreak = false } = {}) => {
  // 1년 이내 게시물만 streak 계산에 사용 (UI 윈도우가 최대 365일).
  const streakSince = new Date(Date.now() - STREAK_WINDOW_DAYS * 86400000);

  const [
    publishedPostsCount,
    characterAggregate,
    receivedLikes,
    followers,
    following,
    likedCount,
    bookmarkedCount,
    streakPosts,
  ] = await Promise.all([
    prisma.post.count({
      where: {
        authorId: user.id,
        status: 'PUBLISHED',
      },
    }),
    // 본문 통째로 가져오던 무거운 쿼리를 캐시 컬럼 합산으로 대체.
    prisma.post.aggregate({
      where: {
        authorId: user.id,
        status: 'PUBLISHED',
      },
      _sum: { characterCount: true },
    }),
    prisma.like.count({
      where: {
        post: {
          authorId: user.id,
          status: 'PUBLISHED',
        },
      },
    }),
    prisma.follow.findMany({
      where: {
        followingId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 12,
      include: {
        follower: true,
      },
    }),
    prisma.follow.findMany({
      where: {
        followerId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 12,
      include: {
        following: true,
      },
    }),
    // 본인 프로필일 때만 좋아요/북마크 개수 노출 (사적 정보).
    includePrivate
      ? prisma.like.count({ where: { userId: user.id, post: { status: 'PUBLISHED' } } })
      : Promise.resolve(0),
    includePrivate
      ? prisma.bookmark.count({ where: { userId: user.id, post: { status: 'PUBLISHED' } } })
      : Promise.resolve(0),
    includeStreak
      ? prisma.post.findMany({
          where: {
            authorId: user.id,
            status: 'PUBLISHED',
            createdAt: { gte: streakSince },
          },
          select: {
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const characterCount = characterAggregate?._sum?.characterCount ?? 0;
  const streakStats = includeStreak
    ? {
        streak: buildStreak(streakPosts),
        streakLabels: {
          30: makeStreakLabels(30),
          90: makeStreakLabels(90),
          365: makeStreakLabels(365),
        },
      }
    : {};

  return {
    stats: {
      posts: publishedPostsCount,
      characters: characterCount,
      receivedLikes,
      followers: followers.length,
      following: following.length,
      ...(includePrivate ? { likedCount, bookmarkedCount } : {}),
      ...streakStats,
    },
    followers: followers.map((item) => formatProfileUser(item.follower)),
    following: following.map((item) => formatProfileUser(item.following)),
  };
};

const toPublicProfile = async (user, viewer = null, options = {}) => ({
  ...toPublicUser(user),
  ...(await makeProfileDetails(user, viewer, options)),
  posts: user.posts?.map((post) => toPublicPost(post, viewer)) || [],
});

export const usersRouter = Router();

usersRouter.get('/users/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        posts: {
          // 본인 프로필이므로 PUBLISHED + HIDDEN(나만 보기) 모두 포함. DRAFT는 제외.
          where: {
            status: { in: ['PUBLISHED', 'HIDDEN'] },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 24,
          include: postInclude,
        },
      },
    });

    res.json({
      profile: await toPublicProfile(user, user, { includePrivate: true, includeStreak: true }),
    });
  } catch (error) {
    next(error);
  }
});

// 내가 좋아요한 글 목록 — 페이지네이션. 프로필 첫 로드와 분리해 lazy fetch.
usersRouter.get('/users/me/likes', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        likes: { some: { userId: req.user.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: postInclude,
    });

    res.json({ posts: posts.map((post) => toPublicPost(post, req.user)) });
  } catch (error) {
    next(error);
  }
});

// 내가 저장(북마크)한 글 목록.
usersRouter.get('/users/me/bookmarks', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        bookmarks: { some: { userId: req.user.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: postInclude,
    });

    res.json({ posts: posts.map((post) => toPublicPost(post, req.user)) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/me', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(profileSchema, req.body);
    const nextHandle = body.handle ? normalizeHandle(body.handle) : undefined;

    if (nextHandle && nextHandle !== req.user.handle) {
      if (isReservedHandle(nextHandle)) {
        throw conflict('Handle is reserved');
      }

      const existing = await prisma.user.findUnique({
        where: {
          handle: nextHandle,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        throw conflict('Handle is already taken');
      }
    }

    const user = await prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(nextHandle !== undefined ? { handle: nextHandle } : {}),
        ...(body.bio !== undefined ? { bio: body.bio || null } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl || null } : {}),
      },
    });

    res.json({
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/users/me', authenticate, async (req, res, next) => {
  try {
    await prisma.user.delete({
      where: {
        id: req.user.id,
      },
    });

    res.json({
      ok: true,
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/users/:handle', async (req, res, next) => {
  try {
    const handle = req.params.handle.toLowerCase();
    const user = await prisma.user.findUnique({
      where: {
        handle,
      },
      include: {
        posts: {
          where: {
            status: 'PUBLISHED',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 24,
          include: postInclude,
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      profile: await toPublicProfile(user, null, { includeStreak: true }),
    });
  } catch (error) {
    next(error);
  }
});
