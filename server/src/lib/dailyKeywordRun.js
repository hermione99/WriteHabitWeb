import { prisma } from './prisma.js';
import { toTodayKeyword } from './keywordDto.js';
import { sendPushToUser } from './push.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from './kstDate.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const currentKstHour = () => new Date(Date.now() + KST_OFFSET_MS).getUTCHours();

const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 1000;
const STREAK_LOOKBACK_DAYS = 365;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayKey = (date) => Math.floor(startOfKstTodayAsUtcDate(date).getTime() / 86400000);

/**
 * 매시 트리거에서 호출되어 알림을 발송하는 핵심 로직.
 *
 * 옵션:
 *   forcedHour - 0..23 사이 정수면 현재 시각 대신 그 시각을 사용. 디버깅/즉시
 *     테스트용. 미지정이면 현재 KST 시각.
 *
 * 반환: { keyword, candidates, alreadyPosted, notified } 요약 객체.
 *   keyword가 null이면 오늘 스케줄이 없는 상태.
 */
export const runDailyKeyword = async ({ forcedHour } = {}) => {
  const todayUtc = startOfKstTodayAsUtcDate();
  const tomorrowUtc = addUtcDays(todayUtc, 1);
  const lookbackUtc = addUtcDays(todayUtc, -STREAK_LOOKBACK_DAYS);
  const todayKeyId = dayKey(todayUtc);
  const hour = Number.isInteger(forcedHour) ? forcedHour : currentKstHour();

  console.log(`[daily-keyword] hour=${hour}`);

  const schedule = await prisma.keywordSchedule.findFirst({
    where: {
      startsAt: { gte: todayUtc, lt: tomorrowUtc },
      status: { in: ['ACTIVE', 'SCHEDULED'] },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { keyword: true },
  });
  if (!schedule) {
    console.log('[daily-keyword] No keyword scheduled for today.');
    return { keyword: null, candidates: 0, alreadyPosted: 0, notified: 0 };
  }
  const keyword = toTodayKeyword(schedule);
  console.log(`[daily-keyword] Today's keyword: "${keyword.word}"`);

  const eligibleUsers = await prisma.user.findMany({
    where: {
      notificationHour: hour,
      devices: { some: {} },
    },
    select: { id: true },
  });
  const candidateIds = eligibleUsers.map((u) => u.id);
  if (candidateIds.length === 0) {
    console.log(`[daily-keyword] No users opted into ${hour}:00 with devices.`);
    return { keyword: keyword.word, candidates: 0, alreadyPosted: 0, notified: 0 };
  }

  const postedToday = await prisma.post.findMany({
    where: {
      authorId: { in: candidateIds },
      status: 'PUBLISHED',
      createdAt: { gte: todayUtc, lt: tomorrowUtc },
    },
    select: { authorId: true },
    distinct: ['authorId'],
  });
  const postedTodaySet = new Set(postedToday.map((p) => p.authorId));
  const targetIds = candidateIds.filter((id) => !postedTodaySet.has(id));

  console.log(
    `[daily-keyword] ${candidateIds.length} candidates, ` +
      `${postedTodaySet.size} already posted, ${targetIds.length} to notify.`
  );
  if (targetIds.length === 0) {
    return {
      keyword: keyword.word,
      candidates: candidateIds.length,
      alreadyPosted: postedTodaySet.size,
      notified: 0,
    };
  }

  // streak 계산용 일자 집합을 한 번에 fetch.
  const recentPosts = await prisma.post.findMany({
    where: {
      authorId: { in: targetIds },
      status: 'PUBLISHED',
      createdAt: { gte: lookbackUtc },
    },
    select: { authorId: true, createdAt: true },
  });
  const userActiveDays = new Map();
  for (const p of recentPosts) {
    let set = userActiveDays.get(p.authorId);
    if (!set) {
      set = new Set();
      userActiveDays.set(p.authorId, set);
    }
    set.add(dayKey(p.createdAt));
  }

  const streakOf = (userId) => {
    const days = userActiveDays.get(userId);
    if (!days) return 0;
    let current = 0;
    while (days.has(todayKeyId - 1 - current)) current += 1;
    return current;
  };

  const buildPayload = (userId) => {
    const streak = streakOf(userId);
    const body =
      streak >= 1
        ? `🔥 ${streak}일째 기록이 위험해요! 오늘의 키워드: '${keyword.word}'`
        : `오늘의 키워드 '${keyword.word}' — 어떤 이야기가 떠오르나요?`;
    return {
      title: '오늘의 키워드',
      body,
      data: { type: 'daily', keywordId: keyword.id },
    };
  };

  for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
    const chunk = targetIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((userId) =>
        sendPushToUser(userId, buildPayload(userId)).catch((err) => {
          console.warn(`[daily-keyword] failed for ${userId}:`, err?.message || err);
        })
      )
    );
    if (i + CHUNK_SIZE < targetIds.length) await sleep(CHUNK_DELAY_MS);
  }

  console.log('[daily-keyword] Done.');
  return {
    keyword: keyword.word,
    candidates: candidateIds.length,
    alreadyPosted: postedTodaySet.size,
    notified: targetIds.length,
  };
};
