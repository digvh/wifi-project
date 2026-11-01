import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory } from '../services/network';
import { validate } from '../middleware/validate';
import { redeemVoucherSchema } from '../validators';

const router = Router();

const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many voucher redemption attempts. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/redeem', redeemLimiter, validate(redeemVoucherSchema), async (req, res) => {
  let claimedVoucherId: string | null = null;

  try {
    const { code, tenantSlug } = req.body;
    const normalizedCode = code.trim().toUpperCase();
    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

    const voucher = await prisma.voucher.findUnique({
      where: { codeHash },
      include: { package: true, tenant: true },
    });

    if (!voucher) {
      res.status(404).json({ error: 'Invalid voucher code. Please check your code and try again.' });
      return;
    }

    if (voucher.tenant.slug.toLowerCase() !== tenantSlug.toLowerCase()) {
      res.status(404).json({ error: 'This voucher does not belong to this Wi-Fi network' });
      return;
    }

    if (voucher.status !== 'UNUSED') {
      res.status(400).json({ error: 'This voucher has already been used, is being redeemed, or has expired' });
      return;
    }

    // Honor the router assigned to the package. Only unassigned packages use
    // the tenant's first online gateway as a fallback.
    const routerWhere = voucher.package.routerId
      ? { id: voucher.package.routerId, tenantId: voucher.tenantId, status: 'ONLINE' }
      : { tenantId: voucher.tenantId, status: 'ONLINE' };
    const routerDevice = await prisma.router.findFirst({ where: routerWhere });

    if (!routerDevice) {
      res.status(503).json({ error: 'The Wi-Fi gateway assigned to this package is currently unreachable. Please alert support.' });
      return;
    }

    // Atomically claim the voucher before touching the device. This prevents
    // simultaneous redemption requests from provisioning the same voucher twice.
    const claim = await prisma.voucher.updateMany({
      where: { id: voucher.id, status: 'UNUSED' },
      data: { status: 'REDEEMING' },
    });
    if (claim.count !== 1) {
      res.status(409).json({ error: 'This voucher is already being redeemed. Please retry only if it remains unused.' });
      return;
    }
    claimedVoucherId = voucher.id;

    const routerPassword = decryptSecret(routerDevice.encryptedPassword);
    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host,
      port: routerDevice.apiPort,
      username: routerDevice.username,
      password: routerPassword,
    });

    const provisioned = await adapter.provisionUser({
      username: normalizedCode,
      password: normalizedCode,
      durationMinutes: voucher.package.durationMinutes,
      downloadKbps: voucher.package.downloadKbps,
      uploadKbps: voucher.package.uploadKbps,
      comment: 'PoaFi - ' + voucher.package.name,
    });
    if (!provisioned) {
      throw new Error('The router did not confirm voucher provisioning');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.package.durationMinutes * 60 * 1000);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;
    const activation = await prisma.voucher.updateMany({
      where: { id: voucher.id, status: 'REDEEMING' },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        usedByIp: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : undefined,
      },
    });
    if (activation.count !== 1) {
      throw new Error('Voucher provisioning completed but the activation record could not be finalized');
    }
    claimedVoucherId = null;

    res.json({
      message: 'Voucher provisioned successfully. Confirm that the device and captive portal allow the client online.',
      packageName: voucher.package.name,
      durationMinutes: voucher.package.durationMinutes,
      expiresAt,
    });
  } catch (error: any) {
    if (claimedVoucherId) {
      try {
        await prisma.voucher.updateMany({
          where: { id: claimedVoucherId, status: 'REDEEMING' },
          data: { status: 'UNUSED' },
        });
      } catch (releaseError) {
        console.error('Failed to release voucher redemption claim:', releaseError);
      }
    }
    console.error('Voucher redeem error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Wi-Fi' });
  }
});

export default router;
