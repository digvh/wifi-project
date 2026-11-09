import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Get all setup requests (Admin sees all, Operator sees only their own)
router.get('/', async (req, res) => {
  try {
    const whereClause: any = {};
    if (req.user?.role !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = req.user?.tenantId;
    }

    const requests = await prisma.deviceSetupRequest.findMany({
      where: whereClause,
      include: {
        tenant: { select: { name: true, slug: true } },
        deviceModel: { select: { brand: true, model: true } },
        assignedTo: { select: { email: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch setup requests' });
  }
});

// Create a new setup request
router.post('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant context required' });
      return;
    }

    const { requestType, deviceName, deviceVendor, deviceModelId, notes } = req.body;

    const request = await prisma.deviceSetupRequest.create({
      data: {
        tenantId,
        requestType: requestType || 'SELF',
        deviceName,
        deviceVendor,
        deviceModelId,
        notes,
      },
    });

    res.status(201).json({ message: 'Setup request created', request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create setup request' });
  }
});

// Update a setup request status (Admin only)
router.put('/:id', async (req, res) => {
  try {
    const { status, adminNotes, routerId } = req.body;
    
    const existing = await prisma.deviceSetupRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existing.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updated = await prisma.deviceSetupRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        adminNotes,
        routerId,
        assignedToId: req.user?.userId,
      },
    });

    res.json({ message: 'Request updated', request: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

export default router;