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

// Step 1: start enrollment. Creates a placeholder router + one-time token + script.
router.post('/enrollment/start', async (req, res) => {
  try {
    const { tenantId, siteId, name } = req.body;
    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN' ? tenantId : req.user?.tenantId;
    if (!targetTenantId) {
      res.status(400).json({ error: 'Please select an Operator for this router' });
      return;
    }

    const { publicKey, privateKey } = WireGuardService.generateKeys();
    const tunnelIp = await allocateTunnelIp();
    const apiPassword = WireGuardService.generateApiPassword();
    const enrollmentToken = crypto.randomBytes(24).toString('hex');
    const enrollmentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

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
        wgIp: tunnelIp,
        enrollmentToken,
        enrollmentExpiresAt,
      } as any,
    });

    const callbackBase = env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/$/, '') : null;
    const script = WireGuardService.generateMikroTikScript(
      tunnelIp, publicKey, privateKey, created.id, apiPassword,
      { callbackUrl: `${callbackBase || 'https://YOUR_PUBLIC_API_URL'}/api/enroll`, token: enrollmentToken },
    );

    res.status(201).json({
      message: 'Enrollment started. Paste the script into the MikroTik terminal.',
      routerId: created.id,
      script,
      serverConfig: WireGuardService.generateServerConfig(publicKey, tunnelIp),
      expiresAt: enrollmentExpiresAt,
      callbackConfigured: Boolean(callbackBase),
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

    let connection: { ok: boolean; error?: string } = { ok: false };
    try {
      const adapter = RouterAdapterFactory.getAdapter(r.vendor, {
        host: r.host, port: r.apiPort, username: r.username, password: decryptSecret(r.encryptedPassword),
      });
      await adapter.testConnection();
      await prisma.router.update({ where: { id: r.id }, data: { status: 'ONLINE', setupStatus: 'CONFIGURED' } });
      connection = { ok: true };
    } catch (err: any) {
      // The WireGuard peer may not be added on the PoaFi server yet; keep CONFIRMED so it can be re-tested.
      connection = { ok: false, error: err.message || 'Connection test failed' };
    }

    const final: any = await prisma.router.findUnique({ where: { id: r.id } });
    const { encryptedPassword, wgPrivateKey, ...safe } = final;
    res.json({
      message: connection.ok
        ? 'Router confirmed and online.'
        : 'Router confirmed. The connection test did not pass yet; make sure the WireGuard peer is added on the PoaFi server, then press Test.',
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
    const routerScript = WireGuardService.generateMikroTikScript(tunnelIp, publicKey, privateKey, routerDevice.id, apiPassword);
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
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });
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
    } catch (error: any) {
      await prisma.router.update({ where: { id: routerDevice.id }, data: { status: 'ERROR', setupStatus: 'NEEDS_ATTENTION' } });
      res.status(400).json({ error: error.message || 'Connection failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/sessions', async (req, res) => {
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

    const password = decryptSecret(routerDevice.encryptedPassword);
    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host, port: routerDevice.apiPort,
      username: routerDevice.username, password,
    });
    const sessions = await adapter.listActiveSessions();
    res.json({ sessions, count: sessions.length });
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
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);
    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host, port: routerDevice.apiPort,
      username: routerDevice.username, password,
    });
    await adapter.disconnectSession(usernameOrId);
    res.json({ message: `Session ${usernameOrId} disconnected successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to disconnect user' });
  }
});

export default router;
