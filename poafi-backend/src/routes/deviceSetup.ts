import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// SELF = operator configures alone, REMOTE = operator configures with PoaFi token/script,
// ASSISTED = admin helps remotely, PHYSICAL_HANDOVER = operator posts the device to the admin.
const REQUEST_TYPES = ['SELF', 'ASSISTED', 'REMOTE', 'PHYSICAL_HANDOVER'];
// Status flow for physical handover:
// PENDING -> DEVICE_RECEIVED -> IN_PROGRESS -> CONFIGURED (awaiting delivery) -> SHIPPED_BACK -> COMPLETED
const STATUSES = ['PENDING', 'DEVICE_RECEIVED', 'IN_PROGRESS', 'CONFIGURED', 'SHIPPED_BACK', 'COMPLETED', 'CANCELLED'];

// Get all setup requests (Admin sees all or filters by tenantId, Operator sees only their own)
router.get('/', async (req, res) => {
  try {
    const whereClause: any = {};
    if (req.user?.role !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = req.user?.tenantId;
    } else if (req.query.tenantId) {
      whereClause.tenantId = req.query.tenantId as string;
    }

    const requests = await prisma.deviceSetupRequest.findMany({
      where: whereClause,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        deviceModel: { select: { id: true, brand: true, model: true } },
        router: { select: { id: true, name: true, host: true, vendor: true } },
        assignedTo: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (error) {
    console.error('Failed to fetch setup requests:', error);
    res.status(500).json({ error: 'Failed to fetch setup requests' });
  }
});

// Create a new setup request (Operator creates for themselves, or Admin creates to help a selected operator)
router.post('/', async (req, res) => {
  try {
    let tenantId = req.user?.tenantId;
    if (req.user?.role === 'PLATFORM_ADMIN' && req.body.tenantId) {
      tenantId = req.body.tenantId;
    }

    if (!tenantId) {
      res.status(400).json({ error: 'Tafadhali chagua Operator / Please select an Operator' });
      return;
    }

    const { requestType, deviceName, deviceVendor, deviceModelId, notes, routerId, serialNumber, macAddress } = req.body;

    const type = requestType || 'ASSISTED';
    if (!REQUEST_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid requestType. Use one of: ${REQUEST_TYPES.join(', ')}` });
      return;
    }

    const request = await prisma.deviceSetupRequest.create({
      data: {
        tenantId,
        requestType: type,
        deviceName,
        deviceVendor,
        deviceModelId: deviceModelId || null,
        routerId: routerId || null,
        serialNumber: serialNumber ? String(serialNumber).slice(0, 100) : null,
        macAddress: macAddress ? String(macAddress).slice(0, 50) : null,
        notes,
        assignedToId: req.user?.role === 'PLATFORM_ADMIN' ? req.user.userId : null,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    res.status(201).json({ message: 'Setup request created successfully', request });
  } catch (error) {
    console.error('Failed to create setup request:', error);
    res.status(500).json({ error: 'Failed to create setup request' });
  }
});

// Update a setup request status & notes (Admin assists operator or operator updates notes)
router.put('/:id', async (req, res) => {
  try {
    const { status, adminNotes, routerId } = req.body;

    if (status && !STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Use one of: ${STATUSES.join(', ')}` });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && (adminNotes !== undefined || routerId !== undefined)) {
      res.status(403).json({ error: 'Only the PoaFi admin can set engineer notes or link a router' });
      return;
    }
    // Only the platform admin may move a request through the configuration flow;
    // an operator may only cancel their own request.
    if (req.user?.role !== 'PLATFORM_ADMIN' && status && status !== 'CANCELLED') {
      res.status(403).json({ error: 'Only the PoaFi admin can update the configuration status' });
      return;
    }
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
        ...(status && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(routerId !== undefined && { routerId: routerId || null }),
        ...(req.user?.role === 'PLATFORM_ADMIN' && { assignedToId: req.user.userId }),
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        router: { select: { id: true, name: true, host: true } },
      },
    });

    res.json({ message: 'Request updated successfully', request: updated });
  } catch (error) {
    console.error('Failed to update request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

export default router;
