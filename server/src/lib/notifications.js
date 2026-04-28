import { prisma } from './prisma.js';

export const createNotification = async ({ userId, type, title, body = null, data = null }) => {
  if (!userId) return null;

  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data,
    },
  });
};
