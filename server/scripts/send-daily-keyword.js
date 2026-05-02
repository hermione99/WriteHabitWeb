#!/usr/bin/env node
/**
 * 매일 키워드 알림을 모든 활성 사용자에게 발송하는 cron 스크립트.
 *
 * 실행:
 *   node scripts/send-daily-keyword.js
 *
 * Render Cron Job으로 매일 KST 09:00 (UTC 00:00) 에 트리거 권장.
 * - 오늘의 키워드를 조회
 * - 등록된 device가 있는 모든 user에게 push (앱 안 켜본 사용자도 알림 받게)
 * - 주의: 너무 많은 사용자에게 동시 발송 시 APNs rate limit 주의 — 50명씩 chunk
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { toTodayKeyword } from '../src/lib/keywordDto.js';
import { sendPushToUser } from '../src/lib/push.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../src/lib/kstDate.js';

const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const from = startOfKstTodayAsUtcDate();
  const to = addUtcDays(from, 1);

  const schedule = await prisma.keywordSchedule.findFirst({
    where: {
      startsAt: { gte: from, lt: to },
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

  // 등록된 device가 있는 user들만 — 앱을 한 번이라도 설치/로그인한 사람.
  const userIds = await prisma.device.findMany({
    distinct: ['userId'],
    select: { userId: true },
  });

  console.log(`[daily-keyword] Sending to ${userIds.length} users...`);

  const ids = userIds.map((d) => d.userId);
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((userId) =>
        sendPushToUser(userId, {
          title: '오늘의 키워드',
          body: `'${keyword.word}' — ${keyword.sub || '오늘의 한 문장을 적어보세요.'}`,
          data: {
            type: 'daily',
            keywordId: keyword.id,
          },
        }).catch((err) => {
          console.warn(`[daily-keyword] failed for ${userId}:`, err?.message || err);
        })
      )
    );
    if (i + CHUNK_SIZE < ids.length) await sleep(CHUNK_DELAY_MS);
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
