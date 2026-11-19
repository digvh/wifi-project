import { Router } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { VoucherCleanupService } from '../services/cron/VoucherCleanupService';
import { PaymentService } from '../services/payment/PaymentService';

/**
 * Cron trigger for hosts that cannot keep a Node.js process awake
 * (cPanel shared hosting / Passenger). Schedule it with cPanel "Cron Jobs":
 *
 *   curl -fsS -H "X-Cron-Secret: YOUR_CRON_SECRET" https://api.yourdomain.co.tz/api/internal/cron/run
 *
 * Disabled (404) unless CRON_SECRET is configured.
 */
const router = Router();

let lastRunAt = 0;
const MIN_INTERVAL_MS = 20_000;

function secretMatches(provided: unknown): boolean {
  if (!env.CRON_SECRET || typeof provided !== 'string' || provided.length === 0) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(env.CRON_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

async function runJobs(req: any, res: any) {
  if (!env.CRON_SECRET) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const provided = req.header('X-Cron-Secret') || req.query?.key;
  if (!secretMatches(provided)) {
    res.status(401).json({ error: 'Invalid cron secret' });
    return;
  }

  const now = Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) {
    res.json({ ok: true, skipped: true, reason: 'Ran recently' });
    return;
  }
  lastRunAt = now;

  const startedAt = new Date();
  try {
    const recovery = await VoucherCleanupService.recoverOrphanedVouchers();
    const cleanup = await VoucherCleanupService.cleanupExpiredVouchers();
    let provisionRetry: unknown = null;
    try {
      provisionRetry = await PaymentService.retryPendingProvisions();
    } catch (err: any) {
      provisionRetry = { error: err?.message || 'retry failed' };
    }

    res.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      releasedOrphans: recovery.releasedCount,
      expiredVouchers: cleanup.expiredCount,
      provisionRetry,
    });
  } catch (error: any) {
    console.error('[Cron] run failed:', error);
    res.status(500).json({ ok: false, error: 'Cron run failed' });
  }
}

router.get('/run', runJobs);
router.post('/run', runJobs);

export default router;
