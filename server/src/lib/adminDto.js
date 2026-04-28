import { DAY_LABELS, getUtcDateParts, startOfKstTodayAsUtcDate } from './kstDate.js';

const formatDate = (date) => {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const parts = getUtcDateParts(value);
  return `${String(parts.month + 1).padStart(2, '0')}·${String(parts.day).padStart(2, '0')}`;
};

const mapStatus = (status, startsAt) => {
  if (status === 'ACTIVE') return 'live';
  if (status === 'DRAFT') return 'draft';
  if (status === 'ARCHIVED') return 'archived';

  const today = startOfKstTodayAsUtcDate();
  const date = new Date(startsAt);
  if (
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  ) {
    return 'live';
  }
  return 'scheduled';
};

export const toScheduleRow = (schedule) => {
  const startsAt = new Date(schedule.startsAt);
  const parts = getUtcDateParts(startsAt);
  return {
    id: schedule.id,
    keywordId: schedule.keywordId,
    date: formatDate(schedule.startsAt),
    day: DAY_LABELS[parts.weekday],
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
