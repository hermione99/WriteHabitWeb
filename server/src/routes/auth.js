import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/authenticate.js';
import { signAccessToken } from '../lib/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/httpError.js';
import { sendPasswordResetEmail } from '../lib/email.js';
import { isReservedHandle, normalizeHandle } from '../lib/handles.js';
import { prisma } from '../lib/prisma.js';
import { verifyAppleIdToken, verifyGoogleIdToken } from '../lib/socialAuth.js';
import { toPublicUser } from '../lib/userDto.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const handleSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-z][a-z0-9_]*$/);

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

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(255),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(8).max(128),
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

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildResetUrl = (token) => {
  const url = new URL(env.frontendOrigin);
  url.searchParams.set('resetToken', token);
  return url.toString();
};

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

    if (!user.passwordHash) {
      const provider = user.appleSub ? 'Apple' : user.googleSub ? 'Google' : '소셜';
      throw unauthorized(`이 계정은 ${provider} 로그인으로 가입되었습니다.`);
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

authRouter.post('/auth/password-reset/request', async (req, res, next) => {
  try {
    const body = parseBody(passwordResetRequestSchema, req.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      res.json({ ok: true, emailSent: true });
      return;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    const resetUrl = buildResetUrl(token);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    res.json({
      ok: true,
      emailSent: emailResult.sent,
      ...(process.env.NODE_ENV === 'production' ? {} : { resetUrl }),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/password-reset/confirm', async (req, res, next) => {
  try {
    const body = parseBody(passwordResetConfirmSchema, req.body);
    const tokenHash = hashResetToken(body.token);

    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw badRequest('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: {
          id: reset.userId,
        },
        data: {
          passwordHash,
        },
      });
      await tx.passwordResetToken.update({
        where: {
          id: reset.id,
        },
        data: {
          usedAt: new Date(),
        },
      });
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: reset.userId,
          usedAt: null,
          id: {
            not: reset.id,
          },
        },
      });
      return updated;
    });

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

const socialLoginSchema = z.object({
  idToken: z.string().min(1),
  name: z.string().trim().min(1).max(40).optional(),
});

const generateHandleFromEmail = async (email) => {
  const local = (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = local.replace(/^[^a-z]+/, '');
  if (!base || base.length < 3) base = 'writer';
  base = base.slice(0, 16);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 100000)}`;
    if (isReservedHandle(candidate)) continue;
    const exists = await prisma.user.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `writer${crypto.randomBytes(4).toString('hex')}`;
};

const findOrCreateSocialUser = async ({ provider, sub, email, displayName }) => {
  const subField = provider === 'apple' ? 'appleSub' : 'googleSub';

  const linked = await prisma.user.findUnique({ where: { [subField]: sub } });
  if (linked) return { user: linked, isNew: false };

  const normalizedEmail = email ? email.toLowerCase() : null;
  if (normalizedEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (byEmail) {
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: { [subField]: sub },
      });
      return { user: updated, isNew: false };
    }
  }

  if (!normalizedEmail) {
    throw badRequest('이메일 정보가 없어 계정을 만들 수 없습니다.');
  }

  const handle = await generateHandleFromEmail(normalizedEmail);
  const fallbackName = displayName?.trim() || handle;

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      handle,
      displayName: fallbackName.slice(0, 40),
      [subField]: sub,
    },
  });
  return { user: created, isNew: true };
};

const handleSocialAuthError = (error, next, providerLabel) => {
  const code = error?.code || error?.name;
  if (
    code === 'ERR_JWT_INVALID' ||
    code === 'ERR_JWT_EXPIRED' ||
    code === 'ERR_JWS_INVALID' ||
    code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
    code === 'JWTClaimValidationFailed' ||
    code === 'JWTExpired' ||
    code === 'JWSSignatureVerificationFailed' ||
    code === 'JWTInvalid'
  ) {
    next(unauthorized(`${providerLabel} 로그인 토큰이 유효하지 않습니다.`));
    return;
  }
  next(error);
};

authRouter.post('/auth/apple', async (req, res, next) => {
  try {
    const body = parseBody(socialLoginSchema, req.body);
    const claims = await verifyAppleIdToken(body.idToken);
    if (!claims.sub) throw unauthorized('Apple 로그인 토큰이 유효하지 않습니다.');
    const { user, isNew } = await findOrCreateSocialUser({
      provider: 'apple',
      sub: claims.sub,
      email: claims.email,
      displayName: body.name,
    });
    res.json({ ...buildAuthResponse(user), isNewUser: isNew });
  } catch (error) {
    handleSocialAuthError(error, next, 'Apple');
  }
});

authRouter.post('/auth/google', async (req, res, next) => {
  try {
    const body = parseBody(socialLoginSchema, req.body);
    const claims = await verifyGoogleIdToken(body.idToken);
    if (!claims.sub) throw unauthorized('Google 로그인 토큰이 유효하지 않습니다.');
    const { user, isNew } = await findOrCreateSocialUser({
      provider: 'google',
      sub: claims.sub,
      email: claims.email,
      displayName: body.name || claims.name,
    });
    res.json({ ...buildAuthResponse(user), isNewUser: isNew });
  } catch (error) {
    handleSocialAuthError(error, next, 'Google');
  }
});
