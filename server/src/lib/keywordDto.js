const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const LAUNCH_DATE = new Date(2026, 3, 1);

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateStr = (date) =>
  `${date.getFullYear()}·${pad2(date.getMonth() + 1)}·${pad2(date.getDate())}`;

const formatShortDate = (date) => `${pad2(date.getMonth() + 1)}·${pad2(date.getDate())}`;

const formatKeywordNo = (date) => {
  const launchUTC = Date.UTC(
    LAUNCH_DATE.getFullYear(),
    LAUNCH_DATE.getMonth(),
    LAUNCH_DATE.getDate()
  );
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = Math.floor((dateUTC - launchUTC) / 86400000) + 1;
  return String(Math.max(1, dayNum)).padStart(4, '0');
};

export const toTodayKeyword = (schedule) => {
  const date = new Date(schedule.startsAt);
  const word = schedule.keyword?.text || '';
  return {
    id: schedule.keywordId,
    scheduleId: schedule.id,
    word,
    eng: schedule.keyword?.eng || '',
    sub:
      schedule.keyword?.prompt ||
      `오늘의 키워드는 '${word}'입니다. 이 단어가 당신에게 불러오는 한 장면, 한 감정, 한 기억을 짧게 적어 보세요.`,
    no: formatKeywordNo(date),
    dateStr: formatDateStr(date),
    weekday: DAY_LABELS[date.getDay()],
    startsAt: schedule.startsAt,
    status: schedule.status,
  };
};

export const toKeywordArchiveItem = (schedule) => ({
  id: schedule.keywordId,
  scheduleId: schedule.id,
  date: formatShortDate(new Date(schedule.startsAt)),
  word: schedule.keyword?.text || '',
  eng: schedule.keyword?.eng || '',
  count: schedule.keyword?._count?.posts || 0,
  startsAt: schedule.startsAt,
});
