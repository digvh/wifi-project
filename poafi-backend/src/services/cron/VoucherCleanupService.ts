import { prisma } from '../../config/database';
import { decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';

export class VoucherCleanupService {
  private static isRunning = false;
  private static hasRunBootRecovery = false;

  static async recoverOrphanedVouchers(): Promise<{ releasedCount: number }> {
    if (this.hasRunBootRecovery) return { releasedCount: 0 };
    this.hasRunBootRecovery = true;

    try {
      const result = await prisma.voucher.updateMany({
        where: { status: 'REDEEMING' },
        data: { status: 'UNUSED' },
      });
      if (result.count > 0) {
        console.log(
          `[VoucherCleanup] Released ${result.count} orphaned REDEEMING voucher(s) on boot`
        );
      }
      return { releasedCount: result.count };
    } catch (error) {
      console.error('[VoucherCleanup] Boot recovery failed:', error);
      return { releasedCount: 0 };
    }
  }

  static async cleanupExpiredVouchers(): Promise<{ expiredCount: number }> {
    if (this.isRunning) return { expiredCount: 0 };
    this.isRunning = true;

    try {
      const now = new Date();

      const expiredVouchers = await prisma.voucher.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lte: now },
        },
        include: { tenant: true },
        take: 100,
      });

      if (expiredVouchers.length === 0) {
        return { expiredCount: 0 };
      }

      console.log(
        `[Auto-Expiry] Found ${expiredVouchers.length} expired voucher(s) to cleanup...`
      );

      const vouchersByTenant = new Map<string, typeof expiredVouchers>();
      for (const v of expiredVouchers) {
        const list = vouchersByTenant.get(v.tenantId) || [];
        list.push(v);
        vouchersByTenant.set(v.tenantId, list);
      }

      for (const [tenantId, tenantVouchers] of vouchersByTenant.entries()) {
        const radiusNas = await prisma.radiusNas.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true },
        });

        if (radiusNas) {
          console.log(
            `[Auto-Expiry] Tenant ${tenantId} is RADIUS-managed; session ends on NAS. Marking EXPIRED only.`
          );
          continue;
        }

        try {
          const routerDevice = await prisma.router.findFirst({
            where: { tenantId, status: 'ONLINE' },
          });

          if (!routerDevice) {
            console.warn(
              `[Auto-Expiry] No ONLINE router for tenant ${tenantId}; marking EXPIRED in DB only`
            );
            continue;
          }

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
              await adapter.disconnectSession(rawCode);
              await adapter.removeUser(rawCode);
            } catch {
              // Client may have already disconnected or user already removed
            }
          }
        } catch (tenantErr) {
          console.error(
            `[Auto-Expiry] Router cleanup failed for tenant ${tenantId}:`,
            tenantErr
          );
        }
      }

      const voucherIds = expiredVouchers.map((v) => v.id);
      await prisma.voucher.updateMany({
        where: { id: { in: voucherIds } },
        data: { status: 'EXPIRED' },
      });

      console.log(
        `[Auto-Expiry] Successfully marked ${voucherIds.length} vouchers as EXPIRED.`
      );
      return { expiredCount: voucherIds.length };
    } catch (error) {
      console.error('[Auto-Expiry] Error during voucher cleanup:', error);
      return { expiredCount: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  static startBackgroundJob(intervalMs = 60000): NodeJS.Timeout {
    console.log(
      '⏱️ Voucher Auto-Expiry & Router Cleanup Service started (60s interval)'
    );

    this.recoverOrphanedVouchers().catch((err) =>
      console.error('[VoucherCleanup] Boot recovery error:', err)
    );

    this.cleanupExpiredVouchers();

    return setInterval(() => {
      this.cleanupExpiredVouchers();
    }, intervalMs);
  }
}