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

const makeProfileDetails = async (user, viewer = null, { includePrivate = false, includeStreak = false } = {}) => {
  const [
    publishedPostsCount,
    postBodies,
    receivedLikes,
    followers,
    following,
    likedPosts,
    bookmarkedPosts,
    streakPosts,
  ] = await Promise.all([
    prisma.post.count({
      where: {
        authorId: user.id,
        status: 'PUBLISHED',
      },
    }),
    prisma.post.findMany({
      where: {
        authorId: user.id,
        status: 'PUBLISHED',
      },
      select: {
        body: true,
      },
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
      take: 48,
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
      take: 48,
      include: {
        following: true,
      },
    }),
    includePrivate
      ? prisma.post.findMany({
          where: {
            status: 'PUBLISHED',
            likes: {
              some: {
                userId: user.id,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 24,
          include: postInclude,
        })
      : Promise.resolve([]),
    includePrivate
      ? prisma.post.findMany({
          where: {
            status: 'PUBLISHED',
            bookmarks: {
              some: {
                userId: user.id,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 24,
          include: postInclude,
        })
      : Promise.resolve([]),
    includeStreak
      ? prisma.post.findMany({
          where: {
            authorId: user.id,
            status: 'PUBLISHED',
          },
          select: {
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const characterCount = postBodies.reduce((sum, post) => sum + (post.body || '').length, 0);
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
      ...streakStats,
    },
    followers: followers.map((item) => formatProfileUser(item.follower)),
    following: following.map((item) => formatProfileUser(item.following)),
    likedPosts: likedPosts.map((post) => toPublicPost(post, viewer)),
    bookmarkedPosts: bookmarkedPosts.map((post) => toPublicPost(post, viewer)),
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

    res.json({
      profile: await toPublicProfile(user, user, { includePrivate: true }),
    });
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
