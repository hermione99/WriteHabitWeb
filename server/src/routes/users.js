import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest, conflict } from '../lib/httpError.js';
import { isReservedHandle, normalizeHandle } from '../lib/handles.js';
import { prisma } from '../lib/prisma.js';
import { toPublicPost } from '../lib/postDto.js';
import { toPublicUser } from '../lib/userDto.js';

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  handle: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]+$/)
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

const toPublicProfile = (user, viewer = null) => ({
  ...toPublicUser(user),
  stats: {
    posts: user._count?.posts || 0,
    followers: user._count?.followers || 0,
    following: user._count?.following || 0,
  },
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
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    res.json({
      profile: toPublicProfile(user, user),
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
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      profile: toPublicProfile(user),
    });
  } catch (error) {
    next(error);
  }
});
