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
        isOffer: true,
        offerType: true,
        offerActive: true,
        originalPriceTzs: true,
        offerEndsAt: true,
      },
      orderBy: [{ isOffer: 'desc' }, { priceTzs: 'asc' }],
    });

    const now = new Date();
    const visiblePackages = packages.filter((pkg) => {
      if (!pkg.isOffer) return true;
      if (!pkg.offerActive) return false;
      if (pkg.offerEndsAt && pkg.offerEndsAt < now) return false;
      return true;
    });

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.trim() : '';

    const claimFilters: any[] = [];
    if (deviceId) claimFilters.push({ deviceKey: `dev:${deviceId}` });
    if (clientIp) claimFilters.push({ ipAddress: clientIp }, { deviceKey: `ip:${clientIp}` });

    const existingClaims = claimFilters.length > 0
      ? await prisma.offerClaim.findMany({
          where: { tenantId: tenant.id, OR: claimFilters },
          select: { packageId: true },
        })
      : [];

    const claimedOfferIds = Array.from(new Set(existingClaims.map((c) => c.packageId)));

    // Return paymentMode + portal branding so the portal renders tenant-customized UI
    res.json({
      operator: tenant.name,
      paymentMode: (tenant as any).paymentMode || "MIXED",
      branding: {
        logoUrl: (tenant as any).portalLogoUrl || null,
        primaryColor: (tenant as any).portalColor || "#00f3ff",
        tagline: (tenant as any).portalTagline || null,
        supportPhone: (tenant as any).supportPhone || null,
      },
      packages: visiblePackages,
      claimedOfferIds,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public packages' });
  }
});

// Protected routes below
router.use(requireAuth);

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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

router.post('/', validate(createPackageSchema), async (req, res) => {
  try {
    const {
      name,
      priceTzs,
      durationMinutes,
      downloadKbps,
      uploadKbps,
      routerId,
      isOffer,
      offerType,
      offerActive,
      originalPriceTzs,
      offerEndsAt,
    } = req.body;

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
        isOffer: Boolean(isOffer),
        offerType: isOffer ? (offerType || 'LIMITED_PROMO') : null,
        offerActive: isOffer ? (offerActive !== undefined ? Boolean(offerActive) : true) : true,
        originalPriceTzs: originalPriceTzs !== undefined && originalPriceTzs !== null ? parseInt(originalPriceTzs) : null,
        offerEndsAt: offerEndsAt ? new Date(offerEndsAt) : null,
      },
    });

    res.status(201).json({ message: 'Package created successfully', package: newPackage });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

router.put('/:id', validate(updatePackageSchema), async (req, res) => {
  try {
    const packageId = req.params.id;
    const {
      name,
      priceTzs,
      durationMinutes,
      downloadKbps,
      uploadKbps,
      routerId,
      isOffer,
      offerType,
      offerActive,
      originalPriceTzs,
      offerEndsAt,
    } = req.body;

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
        ...(isOffer !== undefined && { isOffer: Boolean(isOffer) }),
        ...(offerType !== undefined && { offerType: offerType || null }),
        ...(offerActive !== undefined && { offerActive: Boolean(offerActive) }),
        ...(originalPriceTzs !== undefined && { originalPriceTzs: originalPriceTzs !== null ? parseInt(originalPriceTzs) : null }),
        ...(offerEndsAt !== undefined && { offerEndsAt: offerEndsAt ? new Date(offerEndsAt) : null }),
      },
    });

    res.json({ message: 'Package updated successfully', package: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

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