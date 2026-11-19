import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory } from '../services/network';
import { TPLinkOmadaAdapter } from '../services/network/adapters/TPLinkOmadaAdapter';
import { WireGuardService } from '../services/network/WireGuardService';
import { validate } from '../middleware/validate';
import { createRouterSchema, updateRouterSchema } from '../validators';

const router = Router();
router.use(requireAuth);

/** Pick an unused 10.8.0.x tunnel address (2-254). */
async function allocateTunnelIp(): Promise<string> {
  const used = await prisma.router.findMany({ where: { wgIp: { not: null } }, select: { wgIp: true } });
  const taken = new Set(used.map((r: any) => r.wgIp));
  for (let n = 2; n <= 254; n++) {
    const candidate = `10.8.0.${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('No free WireGuard tunnel addresses left');
}

function canAccess(req: any, tenantId: string) {
  return req.user?.role === 'PLATFORM_ADMIN' || tenantId === req.user?.tenantId;
}

/**
 * Returns true if the router has checked in via HTTPS phone-home or HTTPS Cloud Sync
 * within the last 5 minutes (used on shared hosting where inbound TCP 8728 / WireGuard is unavailable).
 */
function isHttpsSyncAlive(routerDevice: any, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!routerDevice?.discoveredAt) return false;
  const age = Date.now() - new Date(routerDevice.discoveredAt).getTime();
  return age >= 0 && age <= maxAgeMs;
}

/**
 * Link a newly created or enrolled router back to a DeviceSetupRequest and
 * advance its status to CONFIGURED (unless already COMPLETED).
 */
async function linkSetupRequest(
  setupRequestId: string | null | undefined,
  routerId: string,
  tenantId: string,
  adminUserId?: string,
) {
  if (!setupRequestId) return;
  const reqRecord = await prisma.deviceSetupRequest.findUnique({ where: { id: setupRequestId } });
  if (!reqRecord || reqRecord.tenantId !== tenantId) return;
  await prisma.deviceSetupRequest.update({
    where: { id: setupRequestId },
    data: {
      routerId,
      status: reqRecord.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIGURED',
      ...(adminUserId ? { assignedToId: adminUserId } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Zero-touch enrollment (Method B): generate token + script, router phones home,
// the registration form is auto-filled, the operator/admin confirms.
// ---------------------------------------------------------------------------

// Step 1: start enrollment. Creates a placeholder router + one-time token + full/1-line script.
router.post('/enrollment/start', async (req, res) => {
  try {
    const {
      tenantId,
      siteId,
      name,
      rosVersion: rawRos,
      enableHotspot: rawHotspot,
      enablePppoe: rawPppoe,
      enableRadius: rawRadius,
      hotspotInterface,
      hotspotSubnet,
    } = req.body;
    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN' ? tenantId : req.user?.tenantId;
    if (!targetTenantId) {
      res.status(400).json({ error: 'Please select an Operator for this router' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId },
      select: { slug: true },
    });

    const rosVersion: '7' | '6' = String(rawRos) === '6' ? '6' : '7';
    const enableHotspot = rawHotspot !== false;
    const enablePppoe = rawPppoe === true;
    const wantRadius = Boolean(rawRadius);

    const { publicKey, privateKey } = WireGuardService.generateKeys();
    const tunnelIp = rosVersion === '7' ? await allocateTunnelIp() : '0.0.0.0';
    const apiPassword = WireGuardService.generateApiPassword();
    const enrollmentToken = crypto.randomBytes(24).toString('hex');
    const enrollmentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const setupOptions = {
      rosVersion,
      enableHotspot,
      enablePppoe,
      enableRadius: wantRadius,
      hotspotInterface: typeof hotspotInterface === 'string' ? hotspotInterface.trim().slice(0, 32) : 'bridge',
      hotspotSubnet: typeof hotspotSubnet === 'string' ? hotspotSubnet.trim().slice(0, 20) : '10.5.50',
    };

    const created = await prisma.router.create({
      data: {
        tenantId: targetTenantId,
        siteId: siteId || null,
        name: (name && String(name).trim()) || 'New MikroTik (waiting for device)',
        vendor: 'MIKROTIK',
        host: tunnelIp,
        apiPort: 8728,
        username: 'poafi-cloud',
        encryptedPassword: encryptSecret(apiPassword),
        status: 'PENDING',
        setupStatus: 'AWAITING_ENROLLMENT',
        connectionMode: 'CLOUD_CONTROLLER',
        wgPrivateKey: encryptSecret(privateKey),
        wgPublicKey: publicKey,
        wgIp: rosVersion === '7' ? tunnelIp : null,
        enrollmentToken,
        enrollmentExpiresAt,
        installationNotes: JSON.stringify(setupOptions),
      } as any,
    });

    let radiusSecret: string | undefined;
    const canProvisionRadius = Boolean(wantRadius && env.RADIUS_ENABLED && env.RADIUS_SERVER_HOST && rosVersion === '7');
    if (canProvisionRadius) {
      radiusSecret = crypto.randomBytes(18).toString('base64url');
      await prisma.radiusNas.create({
        data: {
          tenantId: targetTenantId,
          routerId: created.id,
          vendor: 'MIKROTIK',
          name: `${created.name} (RADIUS)`,
          nasname: tunnelIp,
          shortname: `pf-${created.id.slice(0, 8)}`,
          type: 'other',
          encryptedSecret: encryptSecret(radiusSecret),
          description: 'Auto-created during Quick Setup',
        },
      });
    }

    const callbackBase = env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/$/, '') : null;
    const scriptUrl = `${callbackBase || 'https://YOUR_PUBLIC_API_URL'}/api/enroll/script/${enrollmentToken}`;
    const script = WireGuardService.generateMikroTikScript(
      tunnelIp,
      publicKey,
      privateKey,
      created.id,
      apiPassword,
      { callbackUrl: `${callbackBase || 'https://YOUR_PUBLIC_API_URL'}/api/enroll`, token: enrollmentToken },
      {
        ...setupOptions,
        enableRadius: canProvisionRadius,
        radiusServerHost: env.RADIUS_SERVER_HOST,
        radiusSecret,
        tenantSlug: tenant?.slug,
      },
    );

    const portalBase = env.PUBLIC_APP_URL ? env.PUBLIC_APP_URL.replace(/\/$/, '') : null;

    res.status(201).json({
      message: 'Enrollment started. Run the 1-line command or paste the script into the MikroTik terminal.',
      routerId: created.id,
      rosVersion,
      fetchCommand: WireGuardService.generateOneLineFetchCommand(scriptUrl),
      deviceModeCommand: rosVersion === '7' ? WireGuardService.DEVICE_MODE_COMMAND : null,
      script,
      serverConfig: rosVersion === '7' ? WireGuardService.generateServerConfig(publicKey, tunnelIp) : null,
      expiresAt: enrollmentExpiresAt,
      callbackConfigured: Boolean(callbackBase),
      radiusConfigured: canProvisionRadius,
      portalUrl: portalBase && tenant?.slug ? `${portalBase}/portal?tenant=${tenant.slug}` : null,
    });
  } catch (error) {
    console.error('Enrollment start error:', error);
    res.status(500).json({ error: 'Failed to start enrollment' });
  }
});

// Step 2: poll for the device report (used by the frontend to auto-fill the form)
router.get('/:id/enrollment-status', async (req, res) => {
  try {
    const r: any = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!r) { res.status(404).json({ error: 'Router not found' }); return; }
    if (!canAccess(req, r.tenantId)) { res.status(403).json({ error: 'Forbidden' }); return; }

    const expired = r.setupStatus === 'AWAITING_ENROLLMENT' && r.enrollmentExpiresAt && new Date(r.enrollmentExpiresAt) < new Date();
    res.json({
      setupStatus: expired ? 'EXPIRED' : r.setupStatus,
      expiresAt: r.enrollmentExpiresAt,
      tunnelIp: r.wgIp,
      name: r.name,
      discovered: r.discoveredAt ? {
        model: r.discoveredModel,
        serial: r.discoveredSerial,
        identity: r.discoveredIdentity,
        version: r.discoveredVersion,
        discoveredAt: r.discoveredAt,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read enrollment status' });
  }
});

// Step 3: operator/admin confirms the auto-filled details; PoaFi tests the connection
router.post('/:id/confirm-enrollment', async (req, res) => {
  try {
    const r: any = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!r) { res.status(404).json({ error: 'Router not found' }); return; }
    if (!canAccess(req, r.tenantId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (r.setupStatus !== 'DISCOVERED') {
      res.status(400).json({ error: 'The device has not reported in yet. Run the script on the router first.' });
      return;
    }

    const { name, siteId, deviceModelId, setupRequestId } = req.body;
    await prisma.router.update({
      where: { id: r.id },
      data: {
        name: (name && String(name).trim()) || r.discoveredIdentity || r.name,
        siteId: siteId || r.siteId,
        deviceModelId: deviceModelId || r.deviceModelId,
        setupStatus: 'CONFIRMED',
      } as any,
    });

    await linkSetupRequest(
      setupRequestId,
      r.id,
      r.tenantId,
      req.user?.role === 'PLATFORM_ADMIN' ? req.user.userId : undefined,
    );

    let connection: { ok: boolean; mode?: string; error?: string } = { ok: false };
    try {
      const adapter = RouterAdapterFactory.getAdapter(r.vendor, {
        host: r.host, port: r.apiPort, username: r.username, password: decryptSecret(r.encryptedPassword),
      });
      await adapter.testConnection();
      await prisma.router.update({ where: { id: r.id }, data: { status: 'ONLINE', setupStatus: 'CONFIGURED' } });
      connection = { ok: true, mode: 'DIRECT_API' };
    } catch (err: any) {
      if (isHttpsSyncAlive(r)) {
        await prisma.router.update({ where: { id: r.id }, data: { status: 'ONLINE', setupStatus: 'CONFIGURED' } });
        connection = { ok: true, mode: 'HTTPS_SYNC' };
      } else {
        connection = { ok: false, error: err.message || 'Connection test failed' };
      }
    }

    const final: any = await prisma.router.findUnique({ where: { id: r.id } });
    const { encryptedPassword, wgPrivateKey, ...safe } = final;
    res.json({
      message: connection.ok
        ? connection.mode === 'HTTPS_SYNC'
          ? 'Router confirmed and online via HTTPS Cloud Sync (Shared Hosting mode).'
          : 'Router confirmed and online.'
        : 'Router confirmed. Waiting for router HTTPS sync or direct API connection.',
      router: safe,
      connection,
    });
  } catch (error) {
    console.error('Confirm enrollment error:', error);
    res.status(500).json({ error: 'Failed to confirm enrollment' });
  }
});


const discoverOmadaSchema = z.object({
  host: z.string().min(1, 'Controller host/IP is required'),
  port: z.coerce.number().int().min(1).max(65535).default(8043),
  username: z.string().min(1, 'Controller username is required'),
  password: z.string().min(1, 'Controller password is required'),
  protocol: z.enum(['http', 'https']).optional(),
});

// Discover Omada Controller sites & devices to auto-fill the registration form
router.post('/discover/omada', validate(discoverOmadaSchema), async (req, res) => {
  try {
    const { host, port, username, password, protocol } = req.body;
    const adapter = new TPLinkOmadaAdapter({
      host,
      port,
      username,
      password,
      extraConfig: protocol ? { protocol } : undefined,
    });
    const discovery = await adapter.discoverController();
    res.json({
      message: `Connected to Omada Controller v${discovery.controllerVer}. Form details discovered.`,
      discovery,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to discover Omada Controller' });
  }
});

const omadaPortalSetupSchema = z.object({
  portalUrl: z.string().url().optional(),
  portalName: z.string().min(1).max(64).optional(),
  walledGardenDomains: z.array(z.string().min(1).max(128)).max(30).optional(),
  siteId: z.string().optional(),
});

// 1-Click Portal & Walled Garden Auto-Setup on an existing TP-Link Omada controller
router.post('/:id/omada-portal-setup', validate(omadaPortalSetupSchema), async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({
      where: { id: req.params.id },
      include: { tenant: { select: { slug: true } } },
    });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (!canAccess(req, routerDevice.tenantId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (routerDevice.vendor !== 'TPLINK_OMADA') {
      res.status(400).json({ error: 'Portal Auto-Setup via Omada API is only available for TPLINK_OMADA devices' });
      return;
    }

    const portalBase = (env.PUBLIC_APP_URL || 'https://app.poafi.co.tz').replace(/\/$/, '');
    const defaultPortalUrl = `${portalBase}/portal?tenant=${encodeURIComponent(routerDevice.tenant?.slug || 'tanga')}`;
    const portalUrl = req.body.portalUrl || defaultPortalUrl;

    const apiHost = env.PUBLIC_API_URL ? (() => { try { return new URL(env.PUBLIC_API_URL).hostname; } catch { return null; } })() : null;
    const extraDomains = [
      ...(req.body.walledGardenDomains || []),
      ...(apiHost ? [apiHost] : []),
    ];

    const adapter = new TPLinkOmadaAdapter({
      host: routerDevice.host,
      port: routerDevice.apiPort,
      username: routerDevice.username,
      password: decryptSecret(routerDevice.encryptedPassword),
    });

    const result = await adapter.configureHotspotPortal({
      portalUrl,
      portalName: req.body.portalName,
      walledGardenDomains: extraDomains,
      siteId: req.body.siteId,
    });

    await prisma.router.update({
      where: { id: routerDevice.id },
      data: { setupStatus: 'CONFIGURED', status: 'ONLINE' },
    });

    res.json({
      message: `Omada Portal "${result.portalName}" ${result.action} with ${result.walledGardenDomains.length} Walled Garden rule(s).`,
      result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to push Omada Portal & Walled Garden config' });
  }
});

// Create a new Router (Direct API)
router.post('/', validate(createRouterSchema), async (req, res) => {
  try {
    const { tenantId, siteId, setupRequestId, deviceModelId, name, host, apiPort, username, password, vendor } = req.body;

    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN' ? (tenantId || req.user?.tenantId) : req.user?.tenantId;
    if (!targetTenantId) {
      res.status(400).json({ error: 'Please select an Operator for this router' });
      return;
    }

    const encryptedPassword = encryptSecret(password);

    const newRouter = await prisma.router.create({
      data: {
        tenantId: targetTenantId,
        siteId: siteId || null,
        deviceModelId: deviceModelId || null,
        name, host,
        apiPort: apiPort ? parseInt(apiPort) : 8728,
        username,
        encryptedPassword,
        vendor: (vendor || 'MIKROTIK').toUpperCase(),
      },
    });

    await linkSetupRequest(
      setupRequestId,
      newRouter.id,
      targetTenantId,
      req.user?.role === 'PLATFORM_ADMIN' ? req.user.userId : undefined,
    );

    const { encryptedPassword: _, wgPrivateKey: __, ...safeRouter } = newRouter as any;
    res.status(201).json({ message: 'Router added successfully', router: safeRouter });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add router' });
  }
});

// Generate WireGuard Cloud Setup Script
router.post('/:id/cloud-setup', async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (routerDevice.vendor !== 'MIKROTIK') {
      res.status(400).json({ error: 'Cloud Setup is currently only available for MikroTik RouterOS v7' });
      return;
    }

    // 1. Generate Keys
    const { publicKey, privateKey } = WireGuardService.generateKeys();
    const tunnelIp = await allocateTunnelIp();
    const apiPassword = WireGuardService.generateApiPassword();
    const enrollmentToken = crypto.randomBytes(16).toString('hex');
    const enrollmentExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // 2. Save to database
    await prisma.router.update({
      where: { id: routerDevice.id },
      data: {
        wgPrivateKey: encryptSecret(privateKey),
        wgPublicKey: publicKey,
        wgIp: tunnelIp,
        enrollmentToken,
        enrollmentExpiresAt,
        connectionMode: 'CLOUD_CONTROLLER',
        host: tunnelIp, // Once connected, PoaFi will talk to the router via the tunnel IP
        apiPort: 8728,
        username: 'poafi-cloud',
        encryptedPassword: encryptSecret(apiPassword),
      }
    });

    // 3. Generate Scripts
    const routerScript = WireGuardService.generateMikroTikScript(
      tunnelIp,
      publicKey,
      privateKey,
      routerDevice.id,
      apiPassword,
      undefined,
      {
        rosVersion: req.body?.rosVersion === '6' ? '6' : '7',
        enableHotspot: req.body?.enableHotspot === true,
      },
    );
    const serverConfig = WireGuardService.generateServerConfig(publicKey, tunnelIp);

    res.json({
      message: 'Script generated. Paste into WinBox.',
      script: routerScript,
      serverConfig,
      expiresAt: enrollmentExpiresAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate cloud setup' });
  }
});

router.get('/', async (req, res) => {
  try {
    const whereClause: any = {};
    if (req.user?.role !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = req.user?.tenantId;
    } else if (req.query.tenantId) {
      whereClause.tenantId = req.query.tenantId as string;
    }
    const routers = await prisma.router.findMany({
      where: whereClause,
      include: { 
        site: true, 
        deviceModel: true,
        tenant: { select: { id: true, name: true, slug: true } }
      },
      orderBy: { name: 'asc' },
    });
    const safeRouters = routers.map((r: any) => {
      const { encryptedPassword, wgPrivateKey, ...clean } = r;
      return clean;
    });
    res.json({ routers: safeRouters });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routers' });
  }
});

router.put('/:id', validate(updateRouterSchema), async (req, res) => {
  try {
    const existingRouter = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!existingRouter) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && existingRouter.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updateData: any = { ...req.body };
    if (req.body.password) updateData.encryptedPassword = encryptSecret(req.body.password);
    delete updateData.password;

    const updated = await prisma.router.update({ where: { id: req.params.id }, data: updateData });
    const { encryptedPassword, wgPrivateKey, ...safeRouter } = updated as any;
    res.json({ message: 'Router updated', router: safeRouter });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update router' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existingRouter = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!existingRouter) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && existingRouter.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await prisma.router.delete({ where: { id: req.params.id } });
    res.json({ message: 'Router deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete router' });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const routerDevice: any = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);
    try {
      const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
        host: routerDevice.host, port: routerDevice.apiPort,
        username: routerDevice.username, password,
      });
      const result = await adapter.testConnection();
      await prisma.router.update({ where: { id: routerDevice.id }, data: { status: 'ONLINE', setupStatus: 'CONFIGURED' } });
      res.json({ message: 'Connection successful', data: result });
      return;
    } catch (error: any) {
      if (isHttpsSyncAlive(routerDevice)) {
        await prisma.router.update({ where: { id: routerDevice.id }, data: { status: 'ONLINE', setupStatus: 'CONFIGURED' } });
        res.json({
          message: 'Router online via HTTPS Cloud Sync (Shared Hosting mode)',
          data: {
            mode: 'HTTPS_SYNC',
            identity: routerDevice.discoveredIdentity || routerDevice.name,
            model: routerDevice.discoveredModel || routerDevice.vendor,
            version: routerDevice.discoveredVersion || 'RouterOS',
            lastSyncAt: routerDevice.discoveredAt,
          },
        });
        return;
      }
      await prisma.router.update({ where: { id: routerDevice.id }, data: { status: 'ERROR', setupStatus: 'NEEDS_ATTENTION' } });
      res.status(400).json({ error: error.message || 'Connection failed' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/sessions', async (req, res) => {
  try {
    const routerDevice: any = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);
    try {
      const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
        host: routerDevice.host, port: routerDevice.apiPort,
        username: routerDevice.username, password,
      });
      const sessions = await adapter.listActiveSessions();
      res.json({ sessions, count: sessions.length, mode: 'DIRECT_API' });
      return;
    } catch (directErr: any) {
      if (routerDevice.status === 'ONLINE' || isHttpsSyncAlive(routerDevice)) {
        const activeVouchers = await prisma.voucher.findMany({
          where: {
            tenantId: routerDevice.tenantId,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
            package: { OR: [{ routerId: null }, { routerId: routerDevice.id }] },
          },
          include: { package: true },
          orderBy: { activatedAt: 'desc' },
          take: 100,
        });

        const sessions = activeVouchers.map((v) => {
          let code = 'VOUCHER';
          try {
            code = decryptSecret(v.encryptedCode);
          } catch {
            /* ignore */
          }
          const elapsedMin = v.activatedAt
            ? Math.max(0, Math.floor((Date.now() - new Date(v.activatedAt).getTime()) / 60000))
            : 0;
          return {
            id: v.id,
            user: code,
            address: v.usedByIp || 'HTTPS-Sync',
            uptime: `${elapsedMin}m`,
            bytesIn: 0,
            bytesOut: 0,
          };
        });

        res.json({ sessions, count: sessions.length, mode: 'HTTPS_SYNC' });
        return;
      }
      res.status(500).json({ error: directErr.message || 'Failed to fetch sessions' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
});

router.post('/:id/disconnect-user', async (req, res) => {
  try {
    const { usernameOrId } = req.body;
    if (!usernameOrId) {
      res.status(400).json({ error: 'usernameOrId is required' });
      return;
    }
    const routerDevice: any = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);
    try {
      const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
        host: routerDevice.host, port: routerDevice.apiPort,
        username: routerDevice.username, password,
      });
      await adapter.disconnectSession(usernameOrId);
      res.json({ message: `Session ${usernameOrId} disconnected successfully` });
      return;
    } catch (directErr: any) {
      // Fallback for Shared Hosting HTTPS Cloud Sync mode: mark voucher EXPIRED so next 15s sync kicks user
      const codeHash = crypto.createHash('sha256').update(String(usernameOrId).trim().toUpperCase()).digest('hex');
      const updated = await prisma.voucher.updateMany({
        where: {
          tenantId: routerDevice.tenantId,
          OR: [{ id: String(usernameOrId) }, { codeHash }],
        },
        data: { status: 'EXPIRED', expiresAt: new Date() },
      });
      if (updated.count > 0 || isHttpsSyncAlive(routerDevice)) {
        res.json({
          message: `Session ${usernameOrId} queued for disconnect on next HTTPS Cloud Sync (<=15s)`,
          mode: 'HTTPS_SYNC',
        });
        return;
      }
      res.status(500).json({ error: directErr.message || 'Failed to disconnect user' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to disconnect user' });
  }
});

export default router;
