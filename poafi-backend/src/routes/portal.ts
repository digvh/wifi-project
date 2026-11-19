import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory } from '../services/network';
import { validate } from '../middleware/validate';
import { redeemVoucherSchema, claimOfferSchema } from '../validators';

const router = Router();

function isHttpsSyncAlive(routerDevice: any, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!routerDevice?.discoveredAt) return false;
  const age = Date.now() - new Date(routerDevice.discoveredAt).getTime();
  return age >= 0 && age <= maxAgeMs;
}

function shouldSkipDirectTcp(routerDevice: any): boolean {
  const host = String(routerDevice?.host || '');
  if (!host || host === '0.0.0.0') return true;
  if (host.startsWith('10.8.0.') && !env.WG_SERVER_ENDPOINT) return true;
  return false;
}

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

    const radiusNas = await prisma.radiusNas.findFirst({
      where: {
        tenantId: voucher.tenantId,
        isActive: true,
        OR: voucher.package.routerId
          ? [{ routerId: null }, { routerId: voucher.package.routerId }]
          : undefined,
      },
      select: { id: true },
    });

    if (radiusNas) {
      res.json({
        requiresDeviceLogin: true,
        message: 'Your voucher is valid. Return to the Wi-Fi sign-in page on this network and enter the voucher there to connect. Your time starts when the network accepts your login.',
        packageName: voucher.package.name,
        durationMinutes: voucher.package.durationMinutes,
      });
      return;
    }

    const routerWhere = voucher.package.routerId
      ? { id: voucher.package.routerId, tenantId: voucher.tenantId, status: 'ONLINE' }
      : { tenantId: voucher.tenantId, status: 'ONLINE' };
    const routerDevice = await prisma.router.findFirst({ where: routerWhere });

    if (!routerDevice) {
      res.status(503).json({ error: 'The Wi-Fi gateway assigned to this package is currently unreachable. Please alert support.' });
      return;
    }

    const claim = await prisma.voucher.updateMany({
      where: { id: voucher.id, status: 'UNUSED' },
      data: { status: 'REDEEMING' },
    });
    if (claim.count !== 1) {
      res.status(409).json({ error: 'This voucher is already being redeemed. Please retry only if it remains unused.' });
      return;
    }
    claimedVoucherId = voucher.id;

    let provisioned = false;
    if (shouldSkipDirectTcp(routerDevice) && (routerDevice.status === 'ONLINE' || isHttpsSyncAlive(routerDevice))) {
      provisioned = true;
    } else {
      try {
        const routerPassword = decryptSecret(routerDevice.encryptedPassword);
        const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
          host: routerDevice.host,
          port: routerDevice.apiPort,
          username: routerDevice.username,
          password: routerPassword,
        });

        provisioned = await adapter.provisionUser({
          username: normalizedCode,
          password: normalizedCode,
          durationMinutes: voucher.package.durationMinutes,
          downloadKbps: voucher.package.downloadKbps,
          uploadKbps: voucher.package.uploadKbps,
          comment: 'PoaFi - ' + voucher.package.name,
        });
      } catch (provErr) {
        if (isHttpsSyncAlive(routerDevice)) {
          provisioned = true;
        } else {
          throw provErr;
        }
      }
    }
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

router.post('/claim-offer', redeemLimiter, validate(claimOfferSchema), async (req, res) => {
  let createdClaimId: string | null = null;
  let createdVoucherId: string | null = null;

  try {
    const { tenantSlug, packageId, deviceId, macAddress, phoneNumber } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });
    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, tenantId: tenant.id },
    });
    if (!pkg || !pkg.isOffer || !pkg.offerActive) {
      res.status(404).json({ error: 'This offer is no longer available' });
      return;
    }
    if (pkg.offerEndsAt && pkg.offerEndsAt < new Date()) {
      res.status(400).json({ error: 'This promotional offer has expired' });
      return;
    }
    if (pkg.offerType !== 'FIRST_TIME_FREE' || pkg.priceTzs > 0) {
      res.status(400).json({ error: 'Only free first-time trial offers can be claimed without payment' });
      return;
    }

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
    const normMac = macAddress ? macAddress.trim().toUpperCase() : '';
    const normDev = deviceId ? deviceId.trim() : '';
    const normPhone = phoneNumber ? phoneNumber.trim() : '';

    const deviceKey = normMac
      ? `mac:${normMac}`
      : normDev
        ? `dev:${normDev}`
        : `ip:${clientIp || 'unknown'}`;

    const duplicateChecks: any[] = [{ deviceKey }];
    if (clientIp) duplicateChecks.push({ ipAddress: clientIp });
    if (normPhone) duplicateChecks.push({ phoneNumber: normPhone });

    const existingClaim = await prisma.offerClaim.findFirst({
      where: {
        tenantId: tenant.id,
        packageId: pkg.id,
        OR: duplicateChecks,
      },
    });

    if (existingClaim) {
      res.status(409).json({
        error: 'You have already claimed this free first-time offer. Please select a paid package to continue.',
      });
      return;
    }

    const rawCode = `FREE${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const batchId = `OFFER-${Date.now()}`;

    const radiusNas = await prisma.radiusNas.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        OR: pkg.routerId ? [{ routerId: null }, { routerId: pkg.routerId }] : undefined,
      },
      select: { id: true },
    });

    const { voucher, claim } = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          batchId,
          tenantId: tenant.id,
          packageId: pkg.id,
          codeHash,
          encryptedCode: encryptSecret(rawCode),
          status: radiusNas ? 'UNUSED' : 'REDEEMING',
        },
      });
      const claim = await tx.offerClaim.create({
        data: {
          tenantId: tenant.id,
          packageId: pkg.id,
          deviceKey,
          ipAddress: clientIp || null,
          phoneNumber: normPhone || null,
          voucherCode: rawCode,
        },
      });
      return { voucher, claim };
    });

    createdVoucherId = voucher.id;
    createdClaimId = claim.id;

    if (radiusNas) {
      createdClaimId = null;
      createdVoucherId = null;
      res.json({
        requiresDeviceLogin: true,
        voucherCode: rawCode,
        packageName: pkg.name,
        durationMinutes: pkg.durationMinutes,
        message: 'Your free trial voucher is ready. Enter it on the Wi-Fi sign-in page to connect.',
      });
      return;
    }

    const routerWhere = pkg.routerId
      ? { id: pkg.routerId, tenantId: tenant.id, status: 'ONLINE' }
      : { tenantId: tenant.id, status: 'ONLINE' };
    const routerDevice = await prisma.router.findFirst({ where: routerWhere });

    if (!routerDevice) {
      throw new Error('No online Wi-Fi gateway is available right now. Please try again shortly.');
    }

    let provisioned = false;
    if (shouldSkipDirectTcp(routerDevice) && (routerDevice.status === 'ONLINE' || isHttpsSyncAlive(routerDevice))) {
      provisioned = true;
    } else {
      try {
        const routerPassword = decryptSecret(routerDevice.encryptedPassword);
        const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
          host: routerDevice.host,
          port: routerDevice.apiPort,
          username: routerDevice.username,
          password: routerPassword,
        });

        provisioned = await adapter.provisionUser({
          username: rawCode,
          password: rawCode,
          durationMinutes: pkg.durationMinutes,
          downloadKbps: pkg.downloadKbps,
          uploadKbps: pkg.uploadKbps,
          comment: `PoaFi Free Offer - ${pkg.name}`,
        });
      } catch (provErr) {
        if (isHttpsSyncAlive(routerDevice)) {
          provisioned = true;
        } else {
          throw provErr;
        }
      }
    }

    if (!provisioned) {
      throw new Error('The router did not confirm free trial activation');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + pkg.durationMinutes * 60 * 1000);
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        usedByIp: clientIp || undefined,
      },
    });

    createdClaimId = null;
    createdVoucherId = null;

    res.json({
      voucherCode: rawCode,
      packageName: pkg.name,
      durationMinutes: pkg.durationMinutes,
      expiresAt,
      message: 'Your free trial has been activated!',
    });
  } catch (error: any) {
    if (createdClaimId || createdVoucherId) {
      try {
        if (createdClaimId) await prisma.offerClaim.delete({ where: { id: createdClaimId } });
        if (createdVoucherId) await prisma.voucher.delete({ where: { id: createdVoucherId } });
      } catch (rollbackErr) {
        console.error('Failed to roll back offer claim:', rollbackErr);
      }
    }
    console.error('Claim offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to activate free offer' });
  }
});

export default router;