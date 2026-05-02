import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';

const registerSchema = z.object({
  token: z.string().trim().min(20).max(256),
  platform: z.enum(['ios', 'android']).default('ios'),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) throw badRequest('Invalid request body');
  return result.data;
};

export const devicesRouter = Router();

/**
 * 기기 push token 등록.
 * 같은 token이 이미 있으면 (예: 다른 사용자에게 묶여있던 token이 양도되는 경우) upsert로 owner를 갱신.
 */
devicesRouter.post('/devices', authenticate, async (req, res, next) => {
  try {
    const body = parseBody(registerSchema, req.body);
    const device = await prisma.device.upsert({
      where: { token: body.token },
      create: {
        userId: req.user.id,
        token: body.token,
        platform: body.platform,
      },
      update: {
        userId: req.user.id,
        platform: body.platform,
      },
    });
    res.status(201).json({ ok: true, deviceId: device.id });
  } catch (error) {
    next(error);
  }
});

/**
 * 기기 토큰 해제 (로그아웃 등). 본인 토큰만 삭제 가능.
 */
devicesRouter.delete('/devices/:token', authenticate, async (req, res, next) => {
  try {
    await prisma.device.deleteMany({
      where: {
        token: req.params.token,
        userId: req.user.id,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
