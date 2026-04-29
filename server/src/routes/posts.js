import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { badRequest, unauthorized } from '../lib/httpError.js';
import { toPublicComment } from '../lib/commentDto.js';
import { createNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { toPublicPost } from '../lib/postDto.js';

const postInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20000),
  keywordId: z.string().optional().nullable(),
});

const draftInputSchema = z.object({
  title: z.string().trim().max(120).optional().default(''),
  body: z.string().trim().max(20000).optional().default(''),
  keywordId: z.string().optional().nullable(),
});

const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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

const postCreateInclude = {
  author: true,
  keyword: true,
};

const runAfterResponse = (task) => {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error('Background task failed:', error);
    });
};

export const postsRouter = Router();

postsRouter.get('/posts/drafts', authenticate, async (req, res, next) => {
  try {
    const drafts = await prisma.post.findMany({
      where: {
        authorId: req.user.id,
        status: 'DRAFT',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: postCreateInclude,
    });

    res.json({
      drafts: drafts.map((post) => toPublicPost(post, req.user)),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/posts/drafts', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(draftInputSchema, req.body);
    const draft = await prisma.post.create({
      data: {
        title: body.title || '제목 없는 초안',
        body: body.body || '',
        authorId: req.user.id,
        keywordId: body.keywordId || null,
        status: 'DRAFT',
      },
      include: postCreateInclude,
    });

    res.status(201).json({
      draft: toPublicPost(draft, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.patch('/posts/drafts/:id', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(draftInputSchema.partial(), req.body);
    const existing = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing || existing.status !== 'DRAFT') {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (existing.authorId !== req.user.id) {
      throw unauthorized('You can only edit your own drafts');
    }

    const draft = await prisma.post.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(body.title !== undefined ? { title: body.title || '제목 없는 초안' } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.keywordId !== undefined ? { keywordId: body.keywordId || null } : {}),
      },
      include: postCreateInclude,
    });

    res.json({
      draft: toPublicPost(draft, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/posts/drafts/:id/publish', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(postInputSchema.partial(), req.body);
    const existing = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing || existing.status !== 'DRAFT') {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (existing.authorId !== req.user.id) {
      throw unauthorized('You can only publish your own drafts');
    }

    const title = body.title ?? existing.title;
    const content = body.body ?? existing.body;
    if (!title.trim() || !content.trim()) {
      throw badRequest('Title and body are required to publish');
    }

    const post = await prisma.post.update({
      where: {
        id: existing.id,
      },
      data: {
        title,
        body: content,
        keywordId: body.keywordId !== undefined ? body.keywordId || null : existing.keywordId,
        status: 'PUBLISHED',
      },
      include: postCreateInclude,
    });

    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/posts/drafts/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing || existing.status !== 'DRAFT') {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (existing.authorId !== req.user.id) {
      throw unauthorized('You can only delete your own drafts');
    }

    await prisma.post.delete({
      where: {
        id: existing.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

postsRouter.get('/posts', optionalAuth, async (req, res, next) => {
  try {
    const keywordId = typeof req.query.keywordId === 'string' ? req.query.keywordId : null;
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const searchFilter = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { author: { displayName: { contains: q, mode: 'insensitive' } } },
            { author: { handle: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        ...(keywordId ? { keywordId } : {}),
        ...(!keywordId && keyword ? { keyword: { text: keyword } } : {}),
        ...searchFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
      include: postInclude,
    });

    res.json({
      posts: posts.map((post) => toPublicPost(post, req.user)),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.get('/posts/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
      include: postInclude,
    });

    if (!post || post.status !== 'PUBLISHED') {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/posts', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(postInputSchema, req.body);
    const post = await prisma.post.create({
      data: {
        title: body.title,
        body: body.body,
        authorId: req.user.id,
        keywordId: body.keywordId || null,
      },
      include: postCreateInclude,
    });

    res.status(201).json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.patch('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(postInputSchema.partial(), req.body);
    const existing = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw unauthorized('You can only edit your own posts');
    }

    const post = await prisma.post.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.keywordId !== undefined ? { keywordId: body.keywordId || null } : {}),
      },
      include: postInclude,
    });

    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.post.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw unauthorized('You can only delete your own posts');
    }

    await prisma.post.delete({
      where: {
        id: existing.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const findPublishedPost = async (id) => {
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      status: true,
    },
  });
  return post?.status === 'PUBLISHED' ? post : null;
};

const getPostWithViewerState = (id) =>
  prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });

const commentInclude = {
  author: true,
};

postsRouter.post('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: existing.id,
          userId: req.user.id,
        },
      },
    });

    await prisma.like.upsert({
      where: {
        postId_userId: {
          postId: existing.id,
          userId: req.user.id,
        },
      },
      create: {
        postId: existing.id,
        userId: req.user.id,
      },
      update: {},
    });

    if (!existingLike && existing.authorId !== req.user.id) {
      await createNotification({
        userId: existing.authorId,
        type: 'like',
        title: `${req.user.displayName}님이 회원님의 글을 좋아합니다.`,
        data: {
          actor: {
            id: req.user.id,
            name: req.user.displayName,
            handle: req.user.handle,
            initial: req.user.displayName?.[0] || '?',
            avatarUrl: req.user.avatarUrl || null,
          },
          target: {
            type: 'post',
            id: existing.id,
            title: existing.title,
          },
        },
      });
    }

    const post = await getPostWithViewerState(existing.id);
    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    await prisma.like.deleteMany({
      where: {
        postId: existing.id,
        userId: req.user.id,
      },
    });

    const post = await getPostWithViewerState(existing.id);
    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/posts/:id/bookmark', authenticate, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    await prisma.bookmark.upsert({
      where: {
        postId_userId: {
          postId: existing.id,
          userId: req.user.id,
        },
      },
      create: {
        postId: existing.id,
        userId: req.user.id,
      },
      update: {},
    });

    const post = await getPostWithViewerState(existing.id);
    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/posts/:id/bookmark', authenticate, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    await prisma.bookmark.deleteMany({
      where: {
        postId: existing.id,
        userId: req.user.id,
      },
    });

    const post = await getPostWithViewerState(existing.id);
    res.json({
      post: toPublicPost(post, req.user),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.get('/posts/:id/comments', optionalAuth, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: {
        postId: existing.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: commentInclude,
    });

    res.json({
      comments: comments.map(toPublicComment),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/posts/:id/comments', authenticate, async (req, res, next) => {
  try {
    const existing = await findPublishedPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const body = parseBody(commentInputSchema, req.body);
    const comment = await prisma.comment.create({
      data: {
        postId: existing.id,
        authorId: req.user.id,
        body: body.body,
      },
      include: commentInclude,
    });

    if (existing.authorId !== req.user.id) {
      runAfterResponse(() =>
        createNotification({
          userId: existing.authorId,
          type: 'comment',
          title: `${req.user.displayName}님이 댓글을 남겼습니다.`,
          body: body.body,
          data: {
            preview: body.body,
            actor: {
              id: req.user.id,
              name: req.user.displayName,
              handle: req.user.handle,
              initial: req.user.displayName?.[0] || '?',
              avatarUrl: req.user.avatarUrl || null,
            },
            target: {
              type: 'post',
              id: existing.id,
              title: existing.title,
            },
          },
        })
      );
    }

    res.status(201).json({
      comment: toPublicComment(comment),
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/posts/:postId/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: {
        id: req.params.commentId,
      },
    });

    if (!comment || comment.postId !== req.params.postId) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      throw unauthorized('You can only delete your own comments');
    }

    await prisma.comment.delete({
      where: {
        id: comment.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
