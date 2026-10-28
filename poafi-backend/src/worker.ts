import { env } from './config/env';
import { pool, prisma } from './config/database';
import { VoucherCleanupService } from './services/cron/VoucherCleanupService';

if (!env.RUN_VOUCHER_CLEANUP) {
  console.error('[worker] RUN_VOUCHER_CLEANUP must be true for the dedicated cleanup worker.');
  process.exit(1);
}

console.log('[worker] Starting the Poafi voucher cleanup worker.');
const timer = VoucherCleanupService.startBackgroundJob(60000);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received; shutting down`);
  clearInterval(timer);
  try {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[worker] Shutdown failed', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
