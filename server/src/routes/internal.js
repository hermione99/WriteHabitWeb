import { Router } from 'express';
import { runDailyKeyword } from '../lib/dailyKeywordRun.js';

export const internalRouter = Router();

/**
 * 외부 cron 트리거에서 호출. INTERNAL_SECRET이 환경에 있어야 활성화.
 *
 * 호출 예 (cron-job.org 등):
 *   POST /api/internal/run-daily-keyword
 *   Header: X-Internal-Secret: <INTERNAL_SECRET>
 *
 * Render의 자체 cron job이 가끔 실행을 빠뜨리므로 backup 트리거로 외부 cron
 * 서비스가 매시 정각 이걸 호출하도록 둔다.
 */
internalRouter.post('/internal/run-daily-keyword', async (req, res) => {
  const expected = process.env.INTERNAL_SECRET;
  if (!expected) {
    res.status(503).json({ error: 'INTERNAL_SECRET not configured' });
    return;
  }
  const got = req.get('X-Internal-Secret');
  if (got !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const summary = await runDailyKeyword();
    res.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[internal/run-daily-keyword] FAILED:', error);
    res.status(500).json({ error: error.message || 'Internal error' });
  }
});
