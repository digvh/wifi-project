import { env } from '../config/env';
import { prisma, pool } from '../config/database';
import { VoucherCleanupService } from '../services/cron/VoucherCleanupService';

let busy = false;
let stopping = false;
let timer: NodeJS.Timeout | undefined;

async function runOnce(): Promise<void> {
  if (busy || stopping) return;
  busy = true;
  try {
    const result = await VoucherCleanupService.cleanupExpiredVouchers();
    console.log('[voucher-worker] Cleanup run finished: ' + result.expiredCount + ' voucher(s) expired.');
  } catch (error) {
    console.error('[voucher-worker] Cleanup failed; it will retry on the next run:', error);
  } finally {
    busy = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log('[voucher-worker] ' + signal + ' received; shutting down.');
  if (timer) clearInterval(timer);
  const timeout = setTimeout(() => process.exit(1), env.SHUTDOWN_TIMEOUT_MS);
  timeout.unref();
  try {
    while (busy) await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    console.error('[voucher-worker] Shutdown error:', error);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    process.exit();
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log('[voucher-worker] Starting standalone voucher cleanup worker.');
void runOnce();
timer = setInterval(() => void runOnce(), env.VOUCHER_CLEANUP_INTERVAL_MS);
