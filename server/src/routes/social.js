import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';
import { createNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';

const reportSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(1000).optional().default(''),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body');
  }
  return result.data;
};

const findUserByHandle = async (handle) =>
  prisma.user.findUnique({
    where: {
      handle: handle.toLowerCase(),
    },
  });

export const socialRouter = Router();

socialRouter.get('/social/me', authenticate, async (req, res, next) => {
  try {
    const [following, blocks] = await Promise.all([
      prisma.follow.findMany({
        where: {
          followerId: req.user.id,
        },
        include: {
          following: {
            select: {
              handle: true,
            },
          },
        },
      }),
      prisma.block.findMany({
        where: {
          blockerId: req.user.id,
        },
        include: {
          blocked: {
            select: {
              handle: true,
            },
          },
        },
      }),
    ]);

    res.json({
      following: following.map((item) => item.following.handle),
      blocks: blocks.map((item) => item.blocked.handle),
    });
  } catch (error) {
    next(error);
  }
});

socialRouter.post('/users/:handle/follow', authenticate, async (req, res, next) => {
  try {
    const target = await findUserByHandle(req.params.handle);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (target.id === req.user.id) {
      throw badRequest('You cannot follow yourself');
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user.id,
          followingId: target.id,
        },
      },
    });

    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: req.user.id,
          followingId: target.id,
        },
      },
      create: {
        followerId: req.user.id,
        followingId: target.id,
      },
      update: {},
    });

    if (!existingFollow) {
      await createNotification({
        userId: target.id,
        type: 'follow',
        title: `${req.user.displayName}님이 회원님을 팔로우합니다.`,
        data: {
          actor: {
            id: req.user.id,
            name: req.user.displayName,
            handle: req.user.handle,
            initial: req.user.displayName?.[0] || '?',
            avatarUrl: req.user.avatarUrl || null,
          },
          action: {
            screen: 'profile',
            data: {
              handle: req.user.handle,
              author: req.user.displayName,
              initial: req.user.displayName?.[0] || '?',
            },
          },
        },
      });
    }

    res.json({
      handle: target.handle,
      following: true,
    });
  } catch (error) {
    next(error);
  }
});

socialRouter.delete('/users/:handle/follow', authenticate, async (req, res, next) => {
  try {
    const target = await findUserByHandle(req.params.handle);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.follow.deleteMany({
      where: {
        followerId: req.user.id,
        followingId: target.id,
      },
    });

    res.json({
      handle: target.handle,
      following: false,
    });
  } catch (error) {
    next(error);
  }
});

socialRouter.post('/users/:handle/block', authenticate, async (req, res, next) => {
  try {
    const target = await findUserByHandle(req.params.handle);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (target.id === req.user.id) {
      throw badRequest('You cannot block yourself');
    }

    await prisma.$transaction([
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: req.user.id, followingId: target.id },
            { followerId: target.id, followingId: req.user.id },
          ],
        },
      }),
      prisma.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: req.user.id,
            blockedId: target.id,
          },
        },
        create: {
          blockerId: req.user.id,
          blockedId: target.id,
        },
        update: {},
      }),
    ]);

    res.json({
      handle: target.handle,
      blocked: true,
    });
  } catch (error) {
    next(error);
  }
});

socialRouter.delete('/users/:handle/block', authenticate, async (req, res, next) => {
  try {
    const target = await findUserByHandle(req.params.handle);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.block.deleteMany({
      where: {
        blockerId: req.user.id,
        blockedId: target.id,
      },
    });

    res.json({
      handle: target.handle,
      blocked: false,
    });
  } catch (error) {
    next(error);
  }
});

socialRouter.post('/reports', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(reportSchema, req.body);
    let postId = body.targetId;

    if (body.targetType === 'comment') {
      const comment = await prisma.comment.findUnique({
        where: {
          id: body.targetId,
        },
      });
      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      postId = comment.postId;
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
    });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const report = await prisma.report.create({
      data: {
        postId,
        reporterId: req.user.id,
        reason: `${body.targetType}: ${body.reason}`,
        detail: body.detail,
      },
    });

    res.status(201).json({
      report,
    });
  } catch (error) {
    next(error);
  }
});
