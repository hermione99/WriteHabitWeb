import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../lib/prisma.js';
import { toPublicNotification } from '../lib/notificationDto.js';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    res.json({
      notifications: notifications.map(toPublicNotification),
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.notification.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!existing || existing.userId !== req.user.id) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const notification = await prisma.notification.update({
      where: {
        id: existing.id,
      },
      data: {
        readAt: existing.readAt || new Date(),
      },
    });

    res.json({
      notification: toPublicNotification(notification),
    });
  } catch (error) {
    next(error);
  }
});
