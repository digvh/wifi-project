import { prisma } from '../../config/database';
import { decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';

export class VoucherCleanupService {
  private static isRunning = false;
  private static hasRunBootRecovery = false;

  /**
   * Boot-time recovery: release vouchers stuck in REDEEMING state from a
   * previous server crash. Called once at startup. Any voucher legitimately
   * mid-provision at the moment of boot cannot exist (no live requests),
   * so all REDEEMING vouchers at boot are orphans from prior crashes.
   */
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

  /**
   * Periodic scan: expire ACTIVE vouchers past their expiry timestamp and
   * remove their router-side hotspot users.
   *
   * RADIUS-managed tenants are skipped because:
   *  - Their vouchers were activated via RADIUS Access-Accept
   *  - The NAS tears down the session when Session-Timeout expires
   *  - PoaFi only needs to reflect the new status in its own database
   */
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
        // Skip router-side cleanup for RADIUS-managed tenants — NAS handles it.
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

        // Native-router tenant: disconnect and remove user on the router.
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

  /**
   * Start the recurring background job (default 60 seconds). Also runs a
   * one-time boot recovery to release any orphaned REDEEMING vouchers.
   */
  static startBackgroundJob(intervalMs = 60000): NodeJS.Timeout {
    console.log(
      '⏱️ Voucher Auto-Expiry & Router Cleanup Service started (60s interval)'
    );

    // Boot recovery: release orphans from prior crash
    this.recoverOrphanedVouchers().catch((err) =>
      console.error('[VoucherCleanup] Boot recovery error:', err)
    );

    // Initial expiry pass on boot
    this.cleanupExpiredVouchers();

    // Periodic runs
    return setInterval(() => {
      this.cleanupExpiredVouchers();
    }, intervalMs);
  }
}