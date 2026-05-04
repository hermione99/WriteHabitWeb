import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { adminRouter } from './routes/admin.js';
import { devicesRouter } from './routes/devices.js';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { keywordsRouter } from './routes/keywords.js';
import { notificationsRouter } from './routes/notifications.js';
import { postsRouter } from './routes/posts.js';
import { socialRouter } from './routes/social.js';
import { statsRouter } from './routes/stats.js';
import { streaksRouter } from './routes/streaks.js';
import { uploadsRouter, UPLOADS_ROOT } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  // gzip 압축 — JSON 응답이 큰 엔드포인트(/posts, /users/me 등)에서
  // 전송 크기 70~80% 감소. cors/morgan 등 상위 미들웨어보다 먼저 등록해야
  // 후속 응답에 모두 적용됨.
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.use('/uploads', express.static(UPLOADS_ROOT, {
    fallthrough: false,
    maxAge: '7d',
  }));

  app.use('/api', healthRouter);
  app.use('/api', keywordsRouter);
  app.use('/api', statsRouter);
  app.use('/api', streaksRouter);
  app.use('/api', authRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', postsRouter);
  app.use('/api', usersRouter);
  app.use('/api', socialRouter);
  app.use('/api', uploadsRouter);
  app.use('/api', devicesRouter);
  app.use('/api', adminRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.originalUrl,
    });
  });

  app.use((error, _req, res, _next) => {
    if (error.message?.includes("Can't reach database server")) {
      res.status(503).json({
        error: 'Database unavailable',
      });
      return;
    }

    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
    });
  });

  return app;
};
