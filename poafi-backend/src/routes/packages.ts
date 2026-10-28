import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPackageSchema, updatePackageSchema } from '../validators';

const router = Router();

// Public: Get packages for Captive Portal by tenant slug
router.get('/public/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    const packages = await prisma.package.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        priceTzs: true,
        durationMinutes: true,
        downloadKbps: true,
        uploadKbps: true,
      },
      orderBy: { priceTzs: 'asc' },
    });

    res.json({ operator: tenant.name, packages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public packages' });
  }
});

// Protected routes below
router.use(requireAuth);

// Get all packages (Operator sees theirs; Admin can see all or filter by tenantId)
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

    const [packages, total] = await Promise.all([
      prisma.package.findMany({
        where: whereClause,
        include: {
          router: { select: { id: true, name: true } },
          _count: { select: { vouchers: true } },
        },
        orderBy: { priceTzs: 'asc' },
        skip,
        take: limit,
      }),
      prisma.package.count({ where: whereClause }),
    ]);

    res.json({
      packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Create a new package
router.post('/', validate(createPackageSchema), async (req, res) => {
  try {
    const { name, priceTzs, durationMinutes, downloadKbps, uploadKbps, routerId } = req.body;

    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN'
      ? (req.body.tenantId || req.user.tenantId)
      : req.user?.tenantId;

    if (!targetTenantId) {
      res.status(403).json({ error: 'Tenant context is required to create packages' });
      return;
    }

    const newPackage = await prisma.package.create({
      data: {
        tenantId: targetTenantId,
        routerId: routerId || null,
        name,
        priceTzs: parseInt(priceTzs),
        durationMinutes: parseInt(durationMinutes),
        downloadKbps: downloadKbps ? parseInt(downloadKbps) : 3000,
        uploadKbps: uploadKbps ? parseInt(uploadKbps) : 1000,
      },
    });

    res.status(201).json({ message: 'Package created successfully', package: newPackage });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Update an existing package
router.put('/:id', validate(updatePackageSchema), async (req, res) => {
  try {
    const packageId = req.params.id;
    const { name, priceTzs, durationMinutes, downloadKbps, uploadKbps, routerId } = req.body;

    const existingPackage = await prisma.package.findUnique({ where: { id: packageId } });
    if (!existingPackage) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existingPackage.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this package' });
      return;
    }

    const updated = await prisma.package.update({
      where: { id: packageId },
      data: {
        ...(name !== undefined && { name }),
        ...(priceTzs !== undefined && { priceTzs: parseInt(priceTzs) }),
        ...(durationMinutes !== undefined && { durationMinutes: parseInt(durationMinutes) }),
        ...(downloadKbps !== undefined && { downloadKbps: parseInt(downloadKbps) }),
        ...(uploadKbps !== undefined && { uploadKbps: parseInt(uploadKbps) }),
        ...(routerId !== undefined && { routerId: routerId || null }),
      },
    });

    res.json({ message: 'Package updated successfully', package: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete a package
router.delete('/:id', async (req, res) => {
  try {
    const packageId = req.params.id;

    const existingPackage = await prisma.package.findUnique({ where: { id: packageId } });
    if (!existingPackage) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && existingPackage.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden: You do not own this package' });
      return;
    }

    await prisma.package.delete({ where: { id: packageId } });
    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

export default router;
