const formatRelativeTime = (date) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
};

const formatReadTime = (body) => `${Math.max(1, Math.ceil((body || '').length / 350))}분`;

export const toPublicPost = (post, viewer = null) => {
  const likeUsers = post.likes?.map((like) => like.userId) || [];
  const bookmarkUsers = post.bookmarks?.map((bookmark) => bookmark.userId) || [];
  const authorName = post.author.displayName;

  return {
    id: post.id,
    title: post.title,
    body: post.body,
    author: authorName,
    handle: post.author.handle,
    initial: authorName[0] || '?',
    avatarUrl: post.author.avatarUrl || null,
    time: formatRelativeTime(post.createdAt),
    read: formatReadTime(post.body),
    likes: post._count?.likes || 0,
    comments: post._count?.comments || 0,
    bookmarks: post._count?.bookmarks || 0,
    liked: viewer ? likeUsers.includes(viewer.id) : false,
    bookmarked: viewer ? bookmarkUsers.includes(viewer.id) : false,
    keywordId: post.keywordId || null,
    keyword: post.keyword
      ? {
          id: post.keyword.id,
          word: post.keyword.text,
          eng: post.keyword.eng || '',
          prompt: post.keyword.prompt || '',
        }
      : null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};
