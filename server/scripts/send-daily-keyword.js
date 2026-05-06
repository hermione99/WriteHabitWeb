#!/usr/bin/env node
/**
 * Cron 진입점 — 실제 로직은 src/lib/dailyKeywordRun.js에 있음.
 * Render Cron Job 또는 외부 cron(cron-job.org 등)에서 호출.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { runDailyKeyword } from '../src/lib/dailyKeywordRun.js';

runDailyKeyword()
  .catch((err) => {
    console.error('[daily-keyword] FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
