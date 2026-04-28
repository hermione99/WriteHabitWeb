const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const formatDate = (date) => {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${String(value.getMonth() + 1).padStart(2, '0')}·${String(value.getDate()).padStart(2, '0')}`;
};

const mapStatus = (status, startsAt) => {
  if (status === 'ACTIVE') return 'live';
  if (status === 'DRAFT') return 'draft';
  if (status === 'ARCHIVED') return 'archived';

  const today = new Date();
  const date = new Date(startsAt);
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return 'live';
  }
  return 'scheduled';
};

export const toScheduleRow = (schedule) => {
  const startsAt = new Date(schedule.startsAt);
  return {
    id: schedule.id,
    keywordId: schedule.keywordId,
    date: formatDate(schedule.startsAt),
    day: DAY_LABELS[startsAt.getDay()],
    word: schedule.keyword?.text || '',
    eng: schedule.keyword?.eng || '',
    prompt: schedule.keyword?.prompt || '',
    status: mapStatus(schedule.status, schedule.startsAt),
    by: '운영팀',
    posts: schedule.keyword?._count?.posts ?? null,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
  };
};

export const toAdminReport = (report) => ({
  id: report.id,
  postId: report.postId,
  postTitle: report.post?.title || '',
  postStatus: report.post?.status ? report.post.status.toLowerCase() : null,
  reporter: report.reporter?.handle || 'unknown',
  reason: report.reason,
  detail: report.detail || '',
  status: report.status.toLowerCase(),
  createdAt: report.createdAt,
});
