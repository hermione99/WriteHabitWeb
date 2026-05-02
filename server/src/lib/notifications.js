import { prisma } from './prisma.js';
import { sendPushToUser } from './push.js';

/**
 * 알림을 DB에 기록하고, 사용자의 등록된 디바이스에 푸시도 발송한다.
 * push 실패는 swallow — DB 알림은 어쨌든 떨어졌으니까.
 */
export const createNotification = async ({
  userId,
  type,
  title,
  body = null,
  data = null,
}) => {
  if (!userId) return null;

  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });

  // 푸시는 background — DB 기록 응답을 막지 않도록.
  Promise.resolve()
    .then(() => {
      const pushData = buildPushData(notification, data);
      return sendPushToUser(userId, {
        title,
        body: body || data?.preview || '',
        data: pushData,
      });
    })
    .catch((err) => console.warn('[push] hook failed:', err?.message || err));

  return notification;
};

/**
 * 알림 종류에 따라 클라이언트가 deep-link에 사용할 data 페이로드를 만든다.
 * iOS DeepLinkRouter가 다음 키를 본다:
 *   - postId  → PostDetail로 이동
 *   - handle  → Profile로 이동
 */
const buildPushData = (notification, data) => {
  const out = {
    type: notification.type,
    notificationId: notification.id,
  };
  if (data?.target?.type === 'post' && data.target.id) {
    out.postId = data.target.id;
  }
  if (data?.actor?.handle) {
    out.handle = data.actor.handle;
  }
  return out;
};
