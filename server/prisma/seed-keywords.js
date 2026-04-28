import { PrismaClient } from '@prisma/client';
import { KEYWORD_POOL } from '../../src/data/writehabitData.js';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const LAUNCH_DATE = new Date(2026, 3, 1);
const DAYS_TO_SEED = 120;

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

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const dayOfYear = (date) => {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
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
  const today = startOfDay(new Date());
  let createdOrUpdated = 0;

  for (let offset = 0; offset < DAYS_TO_SEED; offset += 1) {
    const startsAt = startOfDay(new Date(LAUNCH_DATE.getTime() + DAY_MS * offset));
    const shuffled = shuffleSeeded(KEYWORD_POOL, startsAt.getFullYear() * 31 + 7);
    const keyword = shuffled[dayOfYear(startsAt) % shuffled.length];

    await upsertKeywordSchedule({
      startsAt,
      word: keyword.word,
      eng: keyword.eng,
      status: statusFor(startsAt, today),
    });
    createdOrUpdated += 1;
  }

  console.log(`Seeded ${createdOrUpdated} keyword schedules.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
