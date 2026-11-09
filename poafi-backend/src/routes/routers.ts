import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory, ROUTER_ENDPOINT_CATEGORIES, VENDOR_INTEGRATIONS, validateRouterEndpointModel } from '../services/network';
import { validate } from '../middleware/validate';
import { createRouterSchema, updateRouterSchema } from '../validators';

const router = Router();

const enrollmentCallbackSchema = z.object({
  token: z.string().min(32).max(128),
  publicKey: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'Invalid WireGuard public key'),
});

// Public one-time callback: possession of the unguessable token proves this router was issued the script.
router.post('/provisioning/enroll', async (req, res) => {
  const parsed = enrollmentCallbackSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid enrollment payload' }); return; }
  try {
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const enrollment = await prisma.routerProvisioningEnrollment.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() }, status: 'SCRIPT_ISSUED' },
    });
    if (!enrollment) { res.status(404).json({ error: 'Enrollment token is invalid, expired, or already used' }); return; }
    await prisma.routerProvisioningEnrollment.update({
      where: { id: enrollment.id },
      data: { routerPublicKey: parsed.data.publicKey, status: 'WAITING_FOR_SERVER_PEER' },
    });
    res.json({ received: true, status: 'WAITING_FOR_SERVER_PEER' });
  } catch {
    res.status(500).json({ error: 'Could not register router WireGuard public key' });
  }
});

router.use(requireAuth);

async function validateLinkedDeviceModel(deviceModelId: string, vendor: string): Promise<string | null> {
  const model = await prisma.networkDeviceModel.findUnique({ where: { id: deviceModelId } });
  if (!model) return 'Selected device model was not found in the catalogue';
  const validation = validateRouterEndpointModel(vendor, model);
  return validation.valid ? null : validation.reason;
}

// Expose the real driver state so the UI and operators can distinguish a catalogue
// brand from a vendor whose API is actually implemented in PoaFi.
router.get('/integration-capabilities', (_req, res) => {
  res.json({
    integrations: VENDOR_INTEGRATIONS.map((integration) => ({
      ...integration,
      driverAvailable: RouterAdapterFactory.hasAdapter(integration.vendor),
    })),
    registeredDrivers: RouterAdapterFactory.getRegisteredVendors(),
    routerEndpointCategories: ROUTER_ENDPOINT_CATEGORIES,
  });
});

// Create a new Router
router.post('/', validate(createRouterSchema), async (req, res) => {
  try {
    const { tenantId, deviceModelId, siteName, installationAddress, connectionMode, installationNotes, name, host, apiPort, username, password, vendor } = req.body;

    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN'
      ? (tenantId || req.user?.tenantId)
      : req.user?.tenantId;

    if (!targetTenantId) {
      res.status(400).json({ error: 'Please select an Operator for this router' });
      return;
    }

    const normalizedVendor = String(vendor || 'MIKROTIK').trim().toUpperCase();
    if (deviceModelId) {
      const modelError = await validateLinkedDeviceModel(deviceModelId, normalizedVendor);
      if (modelError) { res.status(400).json({ error: modelError }); return; }
    }

    const encryptedPassword = encryptSecret(password);

    const newRouter = await prisma.router.create({
      data: {
        tenantId: targetTenantId,
        deviceModelId: deviceModelId || null,
        siteName: siteName || null,
        installationAddress: installationAddress || null,
        connectionMode: connectionMode || 'DIRECT',
        installationNotes: installationNotes || null,
        name,
        host,
        apiPort: apiPort ? parseInt(apiPort) : 8728,
        username,
        encryptedPassword,
        vendor: normalizedVendor,
      },
    });

    const { encryptedPassword: _, ...safeRouter } = newRouter;
    res.status(201).json({ message: 'Router added successfully', router: safeRouter });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add router' });
  }
});

// Get all routers
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (req.user?.role === 'PLATFORM_ADMIN') {
      if (req.query.tenantId) {
        whereClause.tenantId = req.query.tenantId as string;
      }
    } else {
      whereClause.tenantId = req.user?.tenantId;
    }

    const [routers, total] = await Promise.all([
      prisma.router.findMany({
        where: whereClause,
        include: { tenant: { select: { name: true, slug: true } }, deviceModel: { select: { id: true, brand: true, model: true, category: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.router.count({ where: whereClause }),
    ]);

    const safeRouters = routers.map(({ encryptedPassword, ...r }) => r);

    res.json({
      routers: safeRouters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routers' });
  }
});

// Update a router
router.put('/:id', validate(updateRouterSchema), async (req, res) => {
  try {
    const routerId = req.params.id;
    const { deviceModelId, siteName, installationAddress, connectionMode, installationNotes, name, host, apiPort, username, password, vendor } = req.body;

    const existingRouter = await prisma.router.findUnique({ where: { id: routerId } });
    if (!existingRouter) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existingRouter.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    const nextModelId = deviceModelId !== undefined ? deviceModelId : existingRouter.deviceModelId;
    const nextVendor = vendor !== undefined ? vendor : existingRouter.vendor;
    if (nextModelId) {
      const modelError = await validateLinkedDeviceModel(nextModelId, nextVendor);
      if (modelError) { res.status(400).json({ error: modelError }); return; }
    }

    const updateData: any = {};
    if (deviceModelId !== undefined) updateData.deviceModelId = deviceModelId || null;
    if (siteName !== undefined) updateData.siteName = siteName;
    if (installationAddress !== undefined) updateData.installationAddress = installationAddress;
    if (connectionMode !== undefined) updateData.connectionMode = connectionMode;
    if (installationNotes !== undefined) updateData.installationNotes = installationNotes;
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (apiPort !== undefined) updateData.apiPort = parseInt(apiPort);
    if (username !== undefined) updateData.username = username;
    if (vendor !== undefined) updateData.vendor = vendor.toUpperCase();
    if (password) {
      updateData.encryptedPassword = encryptSecret(password);
    }

    // A changed management endpoint invalidates the last connection result and
    // requires a fresh test/provisioning workflow before the router is trusted.
    const connectionFieldsChanged =
      (vendor !== undefined && vendor !== existingRouter.vendor) ||
      (deviceModelId !== undefined && deviceModelId !== existingRouter.deviceModelId) ||
      (host !== undefined && host !== existingRouter.host) ||
      (apiPort !== undefined && Number(apiPort) !== existingRouter.apiPort) ||
      (username !== undefined && username !== existingRouter.username) ||
      Boolean(password);
    if (connectionFieldsChanged) {
      updateData.status = 'UNKNOWN';
      updateData.setupStatus = 'NEEDS_ATTENTION';
    }

    const updated = await prisma.router.update({
      where: { id: routerId },
      data: updateData,
    });

    const { encryptedPassword: _, ...safeRouter } = updated;
    res.json({ message: 'Router updated successfully', router: safeRouter });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update router' });
  }
});

// Delete a router
router.delete('/:id', async (req, res) => {
  try {
    const routerId = req.params.id;

    const existingRouter = await prisma.router.findUnique({ where: { id: routerId } });
    if (!existingRouter) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existingRouter.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    await prisma.router.delete({ where: { id: routerId } });
    res.json({ message: 'Router deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete router' });
  }
});

// Test Connection with Multi-Brand Adapter Factory
router.post('/:id/test', async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });

    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);

    try {
      const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
        host: routerDevice.host,
        port: routerDevice.apiPort,
        username: routerDevice.username,
        password,
      });

      const result = await adapter.testConnection();

      await prisma.router.update({
        where: { id: routerDevice.id },
        // A successful API login proves reachability only. It does not mean Wi-Fi,
        // hotspot, VLAN, SSID or security configuration has been provisioned.
        data: { status: 'ONLINE' },
      });

      res.json({ message: 'Connection successful', data: result });
    } catch (error: any) {
      await prisma.router.update({
        where: { id: routerDevice.id },
        data: { status: 'ERROR', setupStatus: 'NEEDS_ATTENTION' },
      });
      res.status(400).json({ error: error.message || 'Connection failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Live Active Sessions directly from router
router.get('/:id/sessions', async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });

    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);

    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host,
      port: routerDevice.apiPort,
      username: routerDevice.username,
      password,
    });

    const sessions = await adapter.listActiveSessions();
    res.json({ sessions, count: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch live router sessions' });
  }
});

// Kick/Disconnect an active session
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
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);

    const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
      host: routerDevice.host,
      port: routerDevice.apiPort,
      username: routerDevice.username,
      password,
    });

    await adapter.disconnectSession(usernameOrId);
    res.json({ message: `Session ${usernameOrId} disconnected successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to disconnect user' });
  }
});


// Generate a short-lived MikroTik WireGuard bootstrap script.
// The hub peer remains an explicit administrator action until hub automation is deployed.
router.post('/:id/provisioning-script', async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) { res.status(404).json({ error: 'Router not found' }); return; }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' }); return;
    }
    if (routerDevice.vendor !== 'MIKROTIK') {
      res.status(400).json({ error: 'Cloud-assisted bootstrap is currently available for MikroTik only' }); return;
    }
    if (!env.PUBLIC_API_BASE_URL || !env.PUBLIC_API_BASE_URL.startsWith('https://') ||
        !env.WIREGUARD_SERVER_ENDPOINT || !env.WIREGUARD_SERVER_PUBLIC_KEY) {
      res.status(503).json({ error: 'WireGuard provisioning is not configured. Set PUBLIC_API_BASE_URL, WIREGUARD_SERVER_ENDPOINT and WIREGUARD_SERVER_PUBLIC_KEY first.' }); return;
    }
    if (!/^[A-Za-z0-9+/]{43}=$/.test(env.WIREGUARD_SERVER_PUBLIC_KEY)) {
      res.status(503).json({ error: 'WIREGUARD_SERVER_PUBLIC_KEY is not a valid WireGuard public key' }); return;
    }

    // Allocate an unused address from the dedicated 10.250.0.0/16 management subnet.
    const existing = await prisma.routerProvisioningEnrollment.findMany({ select: { assignedAddress: true } });
    const used = new Set(existing.map((item) => item.assignedAddress.split('/')[0]));
    let hostNumber = 2;
    while (hostNumber < 65535 && used.has('10.250.' + Math.floor(hostNumber / 256) + '.' + (hostNumber % 256))) hostNumber++;
    if (hostNumber >= 65535) { res.status(503).json({ error: 'No free WireGuard router addresses remain' }); return; }
    const assignedAddress = '10.250.' + Math.floor(hostNumber / 256) + '.' + (hostNumber % 256) + '/32';
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const enrollment = await prisma.routerProvisioningEnrollment.create({
      data: { routerId: routerDevice.id, tokenHash, assignedAddress, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const callbackUrl = env.PUBLIC_API_BASE_URL.replace(/\/$/, '') + '/api/routers/provisioning/enroll';
    const wgName = 'poafi-mgmt';
    const script = [
      '# PoaFi one-time MikroTik management tunnel bootstrap',
      '# Token expires in 30 minutes. Run only on the router assigned to this operator.',
      ':local wgName "' + wgName + '"',
      ':if ([:len [/interface/wireguard/find where name=$wgName]] = 0) do={ /interface/wireguard/add name=$wgName comment="PoaFi management tunnel" }',
      ':local wgId [/interface/wireguard/find where name=$wgName]',
      ':local routerPublicKey [/interface/wireguard/get $wgId public-key]',
      '/ip/address/remove [find comment="PoaFi management tunnel address"]',
      '/ip/address/add address="' + assignedAddress + '" interface=$wgName comment="PoaFi management tunnel address"',
      '/ip/route/remove [find comment="PoaFi management server route"]',
      '/ip/route/add dst-address="' + env.WIREGUARD_SERVER_ADDRESS + '/32" gateway=$wgName comment="PoaFi management server route"',
      '/ip/firewall/filter/remove [find comment="PoaFi management API from tunnel"]',
      '/ip/firewall/filter/add chain=input action=accept protocol=tcp src-address="' + env.WIREGUARD_SERVER_ADDRESS + '/32" dst-port=8728 in-interface=$wgName place-before=0 comment="PoaFi management API from tunnel"',
      '/interface/wireguard/peers/remove [find comment="PoaFi management server peer"]',
      '/interface/wireguard/peers/add interface=$wgName public-key="' + env.WIREGUARD_SERVER_PUBLIC_KEY + '" endpoint-address="' + env.WIREGUARD_SERVER_ENDPOINT + '" endpoint-port=' + env.WIREGUARD_SERVER_PORT + ' allowed-address="' + env.WIREGUARD_SERVER_ADDRESS + '/32" persistent-keepalive=25 comment="PoaFi management server peer"',
      ':local payload ("{\\"token\\":\\"' + token + '\\",\\"publicKey\\":\\"" . $routerPublicKey . "\\"}")',
      '/tool/fetch url="' + callbackUrl + '" http-method=post http-header-field="Content-Type: application/json" http-data=$payload output=none',
      ':put "PoaFi tunnel interface configured. Router public key submitted; server peer approval is still required."',
      ':put ("Router WireGuard public key: " . $routerPublicKey)',
    ].join('\n');

    const serverPeerCommand = '/interface/wireguard/peers/add interface=' + env.WIREGUARD_SERVER_INTERFACE +
      ' public-key="<ROUTER_PUBLIC_KEY_FROM_ENROLLMENT>" allowed-address=' + assignedAddress +
      ' comment="PoaFi router ' + routerDevice.id + '"';
    res.json({
      enrollmentId: enrollment.id, expiresAt: enrollment.expiresAt, assignedAddress, script, serverPeerCommand,
      warning: 'The tunnel is not active until the server peer command is applied on the WireGuard hub. Do not expose RouterOS API or Winbox to the public internet.',
    });
  } catch (error: any) {
    console.error('MikroTik provisioning script error:', error);
    res.status(500).json({ error: error.message || 'Could not generate provisioning script' });
  }
});

router.get('/:id/provisioning-status', async (req, res) => {
  try {
    const device = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!device) { res.status(404).json({ error: 'Router not found' }); return; }
    if (req.user?.role !== 'PLATFORM_ADMIN' && device.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' }); return;
    }
    const enrollment = await prisma.routerProvisioningEnrollment.findFirst({
      where: { routerId: device.id }, orderBy: { createdAt: 'desc' },
      select: { id: true, assignedAddress: true, routerPublicKey: true, status: true, expiresAt: true, createdAt: true },
    });
    res.json({ enrollment });
  } catch { res.status(500).json({ error: 'Could not fetch provisioning status' }); }
});

export default router;
