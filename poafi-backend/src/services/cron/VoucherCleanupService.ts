import { prisma } from '../../config/database';
import { decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';

export class VoucherCleanupService {
  private static isRunning = false;

  /**
   * Scan database for expired vouchers, mark them EXPIRED,
   * and clean up their hotspot sessions from the physical/virtual routers.
   */
  static async cleanupExpiredVouchers(): Promise<{ expiredCount: number }> {
    if (this.isRunning) return { expiredCount: 0 };
    this.isRunning = true;

    try {
      const now = new Date();

      // Find active vouchers whose expiry date has passed
      const expiredVouchers = await prisma.voucher.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lte: now,
          },
        },
        include: {
          tenant: true,
        },
        take: 100, // Batch limit for performance
      });

      if (expiredVouchers.length === 0) {
        return { expiredCount: 0 };
      }

      console.log(`[Auto-Expiry] Found ${expiredVouchers.length} expired voucher(s) to cleanup...`);

      // Group by tenant to minimize router connection churn
      const vouchersByTenant = new Map<string, typeof expiredVouchers>();
      for (const v of expiredVouchers) {
        const list = vouchersByTenant.get(v.tenantId) || [];
        list.push(v);
        vouchersByTenant.set(v.tenantId, list);
      }

      for (const [tenantId, tenantVouchers] of vouchersByTenant.entries()) {
        try {
          const routerDevice = await prisma.router.findFirst({
            where: { tenantId, status: 'ONLINE' },
          });

          if (routerDevice) {
            const password = decryptSecret(routerDevice.encryptedPassword);
            const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
              host: routerDevice.host,
              port: routerDevice.apiPort,
              username: routerDevice.username,
              password,
            });

            for (const v of tenantVouchers) {
              try {
                const rawCode = decryptSecret(v.encryptedCode);
                // Disconnect active session from router
                await adapter.disconnectSession(rawCode);
                // Clean up user record on router
                await adapter.removeUser(rawCode);
              } catch (routerErr) {
                // Ignore individual client disconnect errors if user already logged off
              }
            }
          }
        } catch (tenantErr) {
          console.error(`[Auto-Expiry] Failed to connect to router for tenant ${tenantId}:`, tenantErr);
        }
      }

      // Mark status as EXPIRED in DB
      const voucherIds = expiredVouchers.map((v) => v.id);
      await prisma.voucher.updateMany({
        where: {
          id: { in: voucherIds },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      console.log(`[Auto-Expiry] Successfully marked ${voucherIds.length} vouchers as EXPIRED.`);
      return { expiredCount: voucherIds.length };
    } catch (error) {
      console.error('[Auto-Expiry] Error during voucher cleanup:', error);
      return { expiredCount: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start recurring background cron job (runs every 60 seconds)
   */
  static startBackgroundJob(intervalMs = 60000): NodeJS.Timeout {
    console.log('⏱️ Voucher Auto-Expiry & Router Cleanup Service started (Interval: 60s)');
    // Initial run on boot
    this.cleanupExpiredVouchers();

    return setInterval(() => {
      this.cleanupExpiredVouchers();
    }, intervalMs);
  }
}

