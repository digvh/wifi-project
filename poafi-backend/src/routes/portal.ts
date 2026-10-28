import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory } from '../services/network';
import { validate } from '../middleware/validate';
import { redeemVoucherSchema } from '../validators';

const router = Router();

// Rate limiting on captive portal redemption to prevent brute forcing voucher codes
const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per IP per 15 mins
  message: { error: 'Too many voucher redemption attempts. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/redeem', redeemLimiter, validate(redeemVoucherSchema), async (req, res) => {
  try {
    const { code, tenantSlug } = req.body;

    // 1. Hash the code
    const normalizedCode = code.trim().toUpperCase();
    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

    // 2. Find the voucher
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
      res.status(400).json({ error: 'This voucher has already been used or expired' });
      return;
    }

    // 3. Find an online router for this tenant
    const routerDevice = await prisma.router.findFirst({
      where: { tenantId: voucher.tenantId, status: 'ONLINE' },
    });

    if (!routerDevice) {
      res.status(503).json({ error: 'The Wi-Fi gateway router is currently unreachable. Please alert support.' });
      return;
    }

    // 4. Provision via Multi-Brand Router Adapter
    const routerPassword = decryptSecret(routerDevice.encryptedPassword);

    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host,
      port: routerDevice.apiPort,
      username: routerDevice.username,
      password: routerPassword,
    });

    await adapter.provisionUser({
      username: normalizedCode,
      password: normalizedCode,
      durationMinutes: voucher.package.durationMinutes,
      downloadKbps: voucher.package.downloadKbps,
      uploadKbps: voucher.package.uploadKbps,
      comment: `PoaFi - ${voucher.package.name}`,
    });

    // 5. Mark voucher as ACTIVE with activation metadata
    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.package.durationMinutes * 60 * 1000);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;

    await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        usedByIp: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : undefined,
      },
    });

    res.json({
      message: 'Success! You are now connected to the internet.',
      packageName: voucher.package.name,
      durationMinutes: voucher.package.durationMinutes,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Voucher redeem error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Wi-Fi' });
  }
});

export default router;
