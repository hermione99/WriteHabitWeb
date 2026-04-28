import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { signAccessToken } from '../lib/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/httpError.js';
import { isReservedHandle, normalizeHandle } from '../lib/handles.js';
import { prisma } from '../lib/prisma.js';
import { toPublicUser } from '../lib/userDto.js';

const handleSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]+$/);

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(40),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body');
  }
  return result.data;
};

const buildAuthResponse = (user) => ({
  user: toPublicUser(user),
  accessToken: signAccessToken(user),
});

export const authRouter = Router();

authRouter.get('/auth/handles/:handle', async (req, res, next) => {
  try {
    const handleResult = handleSchema.safeParse(req.params.handle);
    if (!handleResult.success) {
      res.json({
        handle: normalizeHandle(req.params.handle),
        available: false,
        reason: 'invalid',
      });
      return;
    }

    const handle = normalizeHandle(handleResult.data);
    if (isReservedHandle(handle)) {
      res.json({
        handle,
        available: false,
        reason: 'reserved',
      });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });

    res.json({
      handle,
      available: !existing,
      reason: existing ? 'taken' : null,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/register', async (req, res, next) => {
  try {
    const body = parseBody(registerSchema, req.body);
    const email = body.email.toLowerCase();
    const handle = normalizeHandle(body.handle);

    if (isReservedHandle(handle)) {
      throw conflict('Handle is reserved');
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { handle }],
      },
      select: {
        email: true,
        handle: true,
      },
    });

    if (existing?.email === email) {
      throw conflict('Email is already registered');
    }
    if (existing?.handle === handle) {
      throw conflict('Handle is already taken');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        handle,
        displayName: body.displayName,
        passwordHash,
      },
    });

    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const body = parseBody(loginSchema, req.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw unauthorized('Invalid email or password');
    }

    const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordOk) {
      throw unauthorized('Invalid email or password');
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/me', authenticate, (req, res) => {
  res.json({
    user: toPublicUser(req.user),
  });
});
