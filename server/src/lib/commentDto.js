const formatRelativeTime = (date) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSec < 60) return '방금';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
};

export const toPublicComment = (comment) => {
  const authorName = comment.author.displayName;

  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    n: authorName,
    i: authorName[0] || '?',
    handle: comment.author.handle,
    avatarUrl: comment.author.avatarUrl || null,
    t: formatRelativeTime(comment.createdAt),
    body: comment.body,
    cl: 0,
    liked: false,
    replyOpen: false,
    replyText: '',
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};
