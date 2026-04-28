const formatRelativeTime = (date) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
};

export const toPublicNotification = (notification) => {
  const data = notification.data || {};
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    text: notification.title,
    body: notification.body || '',
    preview: data.preview || notification.body || '',
    actor: data.actor || null,
    target: data.target || null,
    action: data.action || null,
    time: formatRelativeTime(notification.createdAt),
    read: Boolean(notification.readAt),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
};
