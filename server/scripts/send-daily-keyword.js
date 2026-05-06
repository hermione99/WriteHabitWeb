#!/usr/bin/env node
/**
 * 매시 키워드 알림을 발송하는 cron 스크립트.
 *
 * 실행:
 *   node scripts/send-daily-keyword.js
 *
 * Render Cron Job으로 **매시 정각 (`0 * * * *`)** 트리거.
 * 동작:
 *   1. 현재 KST 시각(0-23) 계산
 *   2. notificationHour가 그 시각과 일치하는 사용자만 대상
 *   3. 그 중 오늘 아직 글을 안 쓴 사람만 추림
 *   4. streak "위험" 메시지 분기 + chunked 발송
 *
 * 사용자가 notificationHour를 null로 설정하면 알림 비활성화 (대상 제외).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { toTodayKeyword } from '../src/lib/keywordDto.js';
import { sendPushToUser } from '../src/lib/push.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../src/lib/kstDate.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const currentKstHour = () => new Date(Date.now() + KST_OFFSET_MS).getUTCHours();

const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 1000;
const STREAK_LOOKBACK_DAYS = 365;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dayKey = (date) => Math.floor(startOfKstTodayAsUtcDate(date).getTime() / 86400000);

const main = async () => {
  const todayUtc = startOfKstTodayAsUtcDate();
  const tomorrowUtc = addUtcDays(todayUtc, 1);
  const lookbackUtc = addUtcDays(todayUtc, -STREAK_LOOKBACK_DAYS);
  const todayKey = dayKey(todayUtc);
  const hour = currentKstHour();

  console.log(`[daily-keyword] Current KST hour: ${hour}`);

  // 1) 오늘의 키워드
  const schedule = await prisma.keywordSchedule.findFirst({
    where: {
      startsAt: { gte: todayUtc, lt: tomorrowUtc },
      status: { in: ['ACTIVE', 'SCHEDULED'] },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { keyword: true },
  });

  if (!schedule) {
    console.log('[daily-keyword] No keyword scheduled for today, skipping.');
    return;
  }
  const keyword = toTodayKeyword(schedule);
  console.log(`[daily-keyword] Today's keyword: "${keyword.word}"`);

  // 2) 이 시각에 알림 받기로 한 사용자 (device도 등록돼 있어야 발송 가능)
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
    return;
  }

  // 3) 오늘 이미 글을 쓴 사용자 제외
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
  if (targetIds.length === 0) return;

  // 4) 각 타겟의 streak 계산을 위해 최근 365일 활동일 한 번에 fetch
  const recentPosts = await prisma.post.findMany({
    where: {
      authorId: { in: targetIds },
      status: 'PUBLISHED',
      createdAt: { gte: lookbackUtc },
    },
    select: { authorId: true, createdAt: true },
  });

  // userId → Set<dayKey>
  const userActiveDays = new Map();
  for (const p of recentPosts) {
    let set = userActiveDays.get(p.authorId);
    if (!set) {
      set = new Set();
      userActiveDays.set(p.authorId, set);
    }
    set.add(dayKey(p.createdAt));
  }

  // 오늘은 안 썼다는 게 이미 확정 → 어제부터 거꾸로 카운트.
  const streakOf = (userId) => {
    const days = userActiveDays.get(userId);
    if (!days) return 0;
    let current = 0;
    while (days.has(todayKey - 1 - current)) current += 1;
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
      data: {
        type: 'daily',
        keywordId: keyword.id,
      },
    };
  };

  // 5) chunked 발송
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
};

main()
  .catch((err) => {
    console.error('[daily-keyword] FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
