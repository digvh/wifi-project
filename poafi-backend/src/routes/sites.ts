import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    const whereClause: any = {};
    if (!isPlatformAdmin) {
      if (!tenantId) {
        res.status(403).json({ error: 'Tenant required' });
        return;
      }
      whereClause.tenantId = tenantId;
    } else if (req.query.tenantId) {
      whereClause.tenantId = req.query.tenantId as string;
    }

    const db = prisma as any;
    const sites = await db.site.findMany({
      where: whereClause,
      include: { _count: { select: { routers: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ sites });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.post('/', async (req, res) => {
  try {
    const targetTenantId = req.user?.role === 'PLATFORM_ADMIN'
      ? (req.body.tenantId || req.user?.tenantId)
      : req.user?.tenantId;

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }

    const { name, address } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Site name required' });
      return;
    }

    const db = prisma as any;
    const site = await db.site.create({
      data: { tenantId: targetTenantId, name, address }
    });
    res.status(201).json({ message: 'Site created', site });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create site' });
  }
});

export default router;
