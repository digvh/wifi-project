import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { RouterAdapterFactory } from '../services/network';
import { validate } from '../middleware/validate';
import { createRouterSchema, updateRouterSchema } from '../validators';

const router = Router();
router.use(requireAuth);

// Create a new Router
router.post('/', validate(createRouterSchema), async (req, res) => {
  try {
    const { tenantId, name, host, apiPort, username, password, vendor } = req.body;

    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN'
      ? (tenantId || req.user?.tenantId)
      : req.user?.tenantId;

    if (!targetTenantId) {
      res.status(400).json({ error: 'Please select an Operator for this router' });
      return;
    }

    const encryptedPassword = encryptSecret(password);

    const newRouter = await prisma.router.create({
      data: {
        tenantId: targetTenantId,
        name,
        host,
        apiPort: apiPort ? parseInt(apiPort) : 8728,
        username,
        encryptedPassword,
        vendor: (vendor || 'MIKROTIK').toUpperCase(),
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
        include: { tenant: { select: { name: true, slug: true } } },
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
    const { name, host, apiPort, username, password, vendor, status } = req.body;

    const existingRouter = await prisma.router.findUnique({ where: { id: routerId } });
    if (!existingRouter) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existingRouter.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this router' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (apiPort !== undefined) updateData.apiPort = parseInt(apiPort);
    if (username !== undefined) updateData.username = username;
    if (vendor !== undefined) updateData.vendor = vendor.toUpperCase();
    if (status !== undefined) updateData.status = status;
    if (password) {
      updateData.encryptedPassword = encryptSecret(password);
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
        data: { status: 'ONLINE' },
      });

      res.json({ message: 'Connection successful', data: result });
    } catch (error: any) {
      await prisma.router.update({
        where: { id: routerDevice.id },
        data: { status: 'ERROR' },
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

export default router;
