import { PrismaClient } from '@prisma/client';
import { KEYWORD_POOL } from '../../src/data/writehabitData.js';
import { addUtcDays, startOfKstTodayAsUtcDate } from '../src/lib/kstDate.js';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const LAUNCH_DATE = new Date(Date.UTC(2026, 3, 1));
/// 최소 시드 일수 (LAUNCH_DATE부터). 아래 main()에서 "오늘로부터 1년 뒤까지"
/// 보장되도록 동적으로 늘어남.
const MIN_DAYS_TO_SEED = 120;
/// 항상 오늘로부터 이 일수만큼은 미래 스케줄이 존재하도록 보장.
const FUTURE_BUFFER_DAYS = 365;

const mulberry32 = (seed) => {
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleSeeded = (items, seed) => {
  const random = mulberry32(seed);
  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const dayOfYear = (date) => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / DAY_MS);
};

const promptFor = (word) =>
  `오늘의 키워드는 '${word}'입니다. 이 단어가 당신에게 불러오는 한 장면, 한 감정, 한 기억을 짧게 적어 보세요.`;

const statusFor = (startsAt, today) => {
  if (startsAt.getTime() === today.getTime()) return 'ACTIVE';
  if (startsAt > today) return 'SCHEDULED';
  return 'ARCHIVED';
};

const upsertKeywordSchedule = async ({ startsAt, word, eng, status }) => {
  const keyword = await prisma.keyword.upsert({
    where: {
      text_publishDate: {
        text: word,
        publishDate: startsAt,
      },
    },
    update: {
      eng,
      prompt: promptFor(word),
      status,
    },
    create: {
      text: word,
      eng,
      prompt: promptFor(word),
      status,
      publishDate: startsAt,
    },
  });

  return prisma.keywordSchedule.upsert({
    where: {
      startsAt,
    },
    update: {
      keywordId: keyword.id,
      status,
    },
    create: {
      keywordId: keyword.id,
      startsAt,
      status,
    },
  });
};

const main = async () => {
  const today = startOfKstTodayAsUtcDate();
  // LAUNCH_DATE 이후 며칠 지났는지. 최소 0.
  const daysFromLaunch = Math.max(
    0,
    Math.round((today.getTime() - LAUNCH_DATE.getTime()) / DAY_MS)
  );
  // 시드 윈도우: LAUNCH_DATE부터 시작해서, 오늘+1년이 항상 포함되도록 길이를 동적으로 늘림.
  // upsert 라서 이미 있는 날짜는 그대로, 새 미래 날짜만 추가됨 → cron으로 매달 돌려도 안전.
  const daysToSeed = Math.max(MIN_DAYS_TO_SEED, daysFromLaunch + FUTURE_BUFFER_DAYS);
  let createdOrUpdated = 0;

  for (let offset = 0; offset < daysToSeed; offset += 1) {
    const startsAt = addUtcDays(LAUNCH_DATE, offset);
    const shuffled = shuffleSeeded(KEYWORD_POOL, startsAt.getUTCFullYear() * 31 + 7);
    const keyword = shuffled[dayOfYear(startsAt) % shuffled.length];

    await upsertKeywordSchedule({
      startsAt,
      word: keyword.word,
      eng: keyword.eng,
      status: statusFor(startsAt, today),
    });
    createdOrUpdated += 1;
  }

  console.log(
    `Seeded ${createdOrUpdated} keyword schedules ` +
      `(window: ${LAUNCH_DATE.toISOString().slice(0, 10)} → ` +
      `${addUtcDays(LAUNCH_DATE, daysToSeed - 1).toISOString().slice(0, 10)}).`
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
