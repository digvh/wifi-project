import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { decryptSecret } from '../utils/crypto';
import { WireGuardService } from '../services/network/WireGuardService';

/**
 * PUBLIC endpoint called by a router (via RouterOS /tool fetch) during zero-touch enrollment.
 * Protected only by the one-time, 30-minute enrollment token, which is consumed on first use.
 */
const router = Router();

const enrollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enrollment attempts' },
});

// Keep only printable, harmless characters and cap length (values are shown in the UI).
const clean = (max: number) =>
  z.string().max(200).transform((v) => v.replace(/[^\w .:@\-\/()]/g, '').trim().slice(0, max)).default('');

const reportSchema = z.object({
  model: clean(80),
  serial: clean(80),
  identity: clean(80),
  version: clean(40),
});

router.post('/', enrollLimiter, async (req, res) => {
  try {
    const token = String(req.header('x-enrollment-token') || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(token)) {
      res.status(401).json({ error: 'Invalid or expired enrollment token' });
      return;
    }

    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid device report' });
      return;
    }

    const found: any = await prisma.router.findUnique({ where: { enrollmentToken: token } });
    if (!found || !found.enrollmentExpiresAt || new Date(found.enrollmentExpiresAt) < new Date()) {
      res.status(401).json({ error: 'Invalid or expired enrollment token' });
      return;
    }

    const { model, serial, identity, version } = parsed.data;

    await prisma.router.update({
      where: { id: found.id },
      data: {
        discoveredModel: model || null,
        discoveredSerial: serial || null,
        discoveredIdentity: identity || null,
        discoveredVersion: version || null,
        discoveredAt: new Date(),
        setupStatus: 'DISCOVERED',
        enrollmentToken: null, // single use
        enrollmentExpiresAt: null,
      } as any,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Enrollment phone-home error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

/**
 * PUBLIC endpoint fetched directly by the MikroTik router via `/tool fetch`
 * during 1-line setup. Protected by the 192-bit, 30-minute enrollmentToken.
 */
router.get('/script/:token', enrollLimiter, async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(token)) {
      res.status(401).type('text/plain').send('# Invalid or expired PoaFi setup token');
      return;
    }

    const found: any = await prisma.router.findUnique({
      where: { enrollmentToken: token },
      include: {
        tenant: { select: { slug: true } },
        radiusNas: { where: { isActive: true }, take: 1 },
      },
    });

    if (!found || !found.enrollmentExpiresAt || new Date(found.enrollmentExpiresAt) < new Date()) {
      res.status(401).type('text/plain').send('# Invalid or expired PoaFi setup token');
      return;
    }

    let storedOptions: any = {};
    if (found.installationNotes) {
      try {
        storedOptions = JSON.parse(found.installationNotes);
      } catch {
        storedOptions = {};
      }
    }

    const privateKey = found.wgPrivateKey ? decryptSecret(found.wgPrivateKey) : '';
    const apiPassword = decryptSecret(found.encryptedPassword);
    const callbackBase = env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/$/, '') : null;

    let radiusSecret: string | undefined;
    if (found.radiusNas?.[0]?.encryptedSecret) {
      try {
        radiusSecret = decryptSecret(found.radiusNas[0].encryptedSecret);
      } catch {
        radiusSecret = undefined;
      }
    }

    const script = WireGuardService.generateMikroTikScript(
      found.wgIp || found.host,
      found.wgPublicKey || '',
      privateKey,
      found.id,
      apiPassword,
      {
        callbackUrl: `${callbackBase || 'https://YOUR_PUBLIC_API_URL'}/api/enroll`,
        token,
      },
      {
        rosVersion: storedOptions.rosVersion === '6' ? '6' : '7',
        enableHotspot: storedOptions.enableHotspot !== false,
        enablePppoe: storedOptions.enablePppoe === true,
        enableRadius: Boolean(storedOptions.enableRadius && radiusSecret && env.RADIUS_SERVER_HOST),
        hotspotInterface: storedOptions.hotspotInterface,
        hotspotSubnet: storedOptions.hotspotSubnet,
        tenantSlug: found.tenant?.slug,
        radiusServerHost: env.RADIUS_SERVER_HOST,
        radiusSecret,
      },
    );

    res.setHeader('Cache-Control', 'no-store');
    res.type('text/plain; charset=utf-8').send(script);
  } catch (error) {
    console.error('Enrollment script fetch error:', error);
    res.status(500).type('text/plain').send('# Failed to generate PoaFi setup script');
  }
});

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: '# Too many sync requests',
});

function keysMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function safeRosToken(val: string): string {
  return String(val || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 48);
}

/**
 * Shared Hosting & NAT-Friendly HTTPS Cloud Sync endpoint.
 * Polled every 15s by the MikroTik scheduler (`poafi-cloud-sync`) over standard HTTPS (port 443).
 * No VPS, no WireGuard server, and no inbound TCP 8728 required.
 */
async function handleRouterHttpsSync(req: any, res: any) {
  try {
    const routerId = String(req.params.routerId || '').trim();
    const providedKey = String(req.header('x-router-key') || req.query?.key || '').trim();

    if (!routerId || !providedKey) {
      res.status(401).type('text/plain').send('# Missing router credentials');
      return;
    }

    const routerDevice: any = await prisma.router.findUnique({
      where: { id: routerId },
    });

    if (!routerDevice || !routerDevice.encryptedPassword) {
      res.status(404).type('text/plain').send('# Router not found');
      return;
    }

    let expectedKey = '';
    try {
      expectedKey = decryptSecret(routerDevice.encryptedPassword);
    } catch {
      res.status(401).type('text/plain').send('# Unable to verify router key');
      return;
    }

    if (!keysMatch(providedKey, expectedKey)) {
      res.status(401).type('text/plain').send('# Unauthorized router key');
      return;
    }

    const now = new Date();

    // Update router heartbeat & promote CONFIRMED -> CONFIGURED + ONLINE
    const nextSetupStatus =
      routerDevice.setupStatus === 'CONFIRMED' || routerDevice.setupStatus === 'DISCOVERED'
        ? 'CONFIGURED'
        : routerDevice.setupStatus;

    await prisma.router.update({
      where: { id: routerDevice.id },
      data: {
        status: 'ONLINE',
        discoveredAt: now,
        setupStatus: nextSetupStatus,
      } as any,
    });

    // Auto-expire any ACTIVE vouchers for this tenant whose expiresAt has passed
    await prisma.voucher.updateMany({
      where: {
        tenantId: routerDevice.tenantId,
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });

    // Fetch active + unused vouchers to ensure they exist on the router
    const activeAndUnusedVouchers = await prisma.voucher.findMany({
      where: {
        tenantId: routerDevice.tenantId,
        OR: [
          { status: 'ACTIVE', expiresAt: { gt: now } },
          { status: 'UNUSED' },
        ],
        package: {
          OR: [{ routerId: null }, { routerId: routerDevice.id }],
        },
      },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    // Fetch recently expired vouchers (last 48 hours) to remove/disconnect from router
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const expiredVouchers = await prisma.voucher.findMany({
      where: {
        tenantId: routerDevice.tenantId,
        status: 'EXPIRED',
        createdAt: { gte: cutoff48h },
        package: {
          OR: [{ routerId: null }, { routerId: routerDevice.id }],
        },
      },
      orderBy: { expiresAt: 'desc' },
      take: 100,
    });

    const lines: string[] = [
      `# PoaFi HTTPS Cloud Sync (${now.toISOString()})`,
    ];

    // 1. Ensure package bandwidth profiles exist
    const seenPackages = new Map<string, { up: number; down: number }>();
    for (const v of activeAndUnusedVouchers) {
      if (v.package && !seenPackages.has(v.package.id)) {
        seenPackages.set(v.package.id, {
          up: Math.max(64, Number(v.package.uploadKbps) || 1000),
          down: Math.max(64, Number(v.package.downloadKbps) || 3000),
        });
      }
    }

    for (const [pkgId, rates] of seenPackages.entries()) {
      const profName = `poafi-pkg-${safeRosToken(pkgId.slice(0, 8))}`;
      lines.push(
        `:if ([:len [/ip hotspot user profile find name="${profName}"]] = 0) do={ :do { /ip hotspot user profile add name="${profName}" rate-limit="${rates.up}k/${rates.down}k" shared-users=1 } on-error={} }`,
      );
    }

    // 2. Provision active & unused vouchers idempotently
    for (const v of activeAndUnusedVouchers) {
      let code = '';
      try {
        code = safeRosToken(decryptSecret(v.encryptedCode));
      } catch {
        continue;
      }
      if (!code || !v.package) continue;

      const profName = `poafi-pkg-${safeRosToken(v.package.id.slice(0, 8))}`;
      const limitMins =
        v.status === 'ACTIVE' && v.expiresAt
          ? Math.max(1, Math.ceil((new Date(v.expiresAt).getTime() - now.getTime()) / 60000))
          : Math.max(1, Number(v.package.durationMinutes) || 60);

      lines.push(
        `:if ([:len [/ip hotspot user find name="${code}"]] = 0) do={ :do { /ip hotspot user add name="${code}" password="${code}" profile="${profName}" limit-uptime="${limitMins}m" comment="PoaFi" } on-error={} }`,
      );
    }

    // 3. Kick and remove expired vouchers
    for (const v of expiredVouchers) {
      let code = '';
      try {
        code = safeRosToken(decryptSecret(v.encryptedCode));
      } catch {
        continue;
      }
      if (!code) continue;

      lines.push(
        `:if ([:len [/ip hotspot user find name="${code}"]] > 0) do={ :do { /ip hotspot active remove [find user="${code}"] } on-error={}; :do { /ip hotspot user remove [find name="${code}"] } on-error={} }`,
      );
    }

    res.setHeader('Cache-Control', 'no-store');
    res.type('text/plain; charset=utf-8').send(lines.join('\n') + '\n');
  } catch (error) {
    console.error('Router HTTPS sync error:', error);
    res.status(500).type('text/plain').send('# PoaFi sync error');
  }
}

router.get('/sync/:routerId', syncLimiter, handleRouterHttpsSync);
router.post('/sync/:routerId', syncLimiter, handleRouterHttpsSync);

export default router;
