import { prisma } from '../../config/database';
import { decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';

export class VoucherCleanupService {
  private static isRunning = false;

  static async cleanupExpiredVouchers(): Promise<{ expiredCount: number }> {
    if (this.isRunning) return { expiredCount: 0 };
    this.isRunning = true;

    try {
      const now = new Date();
      const expiredVouchers = await prisma.voucher.findMany({
        where: { status: 'ACTIVE', expiresAt: { lte: now } },
        include: { package: { select: { routerId: true } } },
        take: 100,
      });

      if (expiredVouchers.length === 0) return { expiredCount: 0 };

      console.log('[Auto-Expiry] Found ' + expiredVouchers.length + ' expired voucher(s) to cleanup...');

      // A package may be pinned to a particular router. Group by that router
      // so cleanup never disconnects a voucher on an unrelated gateway.
      const groups = new Map<string, { tenantId: string; routerId: string | null; vouchers: typeof expiredVouchers }>();
      for (const voucher of expiredVouchers) {
        const routerId = voucher.package.routerId;
        const key = voucher.tenantId + ':' + (routerId || 'AUTO');
        const group = groups.get(key) || { tenantId: voucher.tenantId, routerId, vouchers: [] as typeof expiredVouchers };
        group.vouchers.push(voucher);
        groups.set(key, group);
      }

      for (const group of groups.values()) {
        try {
          const routerDevice = await prisma.router.findFirst({
            where: {
              tenantId: group.tenantId,
              status: 'ONLINE',
              ...(group.routerId ? { id: group.routerId } : {}),
            },
          });

          if (!routerDevice) {
            console.warn('[Auto-Expiry] No online router for tenant ' + group.tenantId + ' and selected package router.');
            continue;
          }

          const password = decryptSecret(routerDevice.encryptedPassword);
          const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
            host: routerDevice.host,
            port: routerDevice.apiPort,
            username: routerDevice.username,
            password,
          });

          for (const voucher of group.vouchers) {
            try {
              const rawCode = decryptSecret(voucher.encryptedCode);
              await adapter.disconnectSession(rawCode);
              await adapter.removeUser(rawCode);
            } catch (routerError) {
              // The voucher is still expired in PoaFi. Log cleanup failures so
              // operators can investigate stale router-side users if needed.
              console.warn('[Auto-Expiry] Router cleanup failed for voucher ' + voucher.id, routerError);
            }
          }
        } catch (tenantError) {
          console.error('[Auto-Expiry] Failed router cleanup for tenant ' + group.tenantId + ':', tenantError);
        }
      }

      const voucherIds = expiredVouchers.map((voucher) => voucher.id);
      const update = await prisma.voucher.updateMany({
        where: { id: { in: voucherIds }, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      console.log('[Auto-Expiry] Marked ' + update.count + ' voucher(s) as EXPIRED.');
      return { expiredCount: update.count };
    } catch (error) {
      console.error('[Auto-Expiry] Error during voucher cleanup:', error);
      return { expiredCount: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  static startBackgroundJob(intervalMs = 60000): NodeJS.Timeout {
    console.log('⏱️ Voucher Auto-Expiry & Router Cleanup Service started (Interval: 60s)');
    this.cleanupExpiredVouchers();
    return setInterval(() => {
      this.cleanupExpiredVouchers();
    }, intervalMs);
  }
}
