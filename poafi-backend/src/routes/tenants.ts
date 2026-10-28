import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
import { hashPassword } from '../utils/auth';
import { validate } from '../middleware/validate';
import { createTenantSchema, updateTenantSchema, createTenantLoginSchema } from '../validators';

const router = Router();

// Protect ALL routes in this file. Platform Admin only.
router.use(requireAuth, requirePlatformAdmin);

// 1. Get all tenants (with optional pagination)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              routers: true,
              packages: true,
              vouchers: true,
              users: true,
            },
          },
        },
      }),
      prisma.tenant.count(),
    ]);

    res.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

// 2. Create a new tenant (Operator)
router.post('/', validate(createTenantSchema), async (req, res) => {
  try {
    const { name, slug } = req.body;

    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      res.status(400).json({ error: 'Slug already exists. Try a different one.' });
      return;
    }

    const tenant = await prisma.tenant.create({
      data: { name, slug },
    });

    res.status(201).json({ message: 'Tenant created successfully', tenant });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Update tenant
router.put('/:id', validate(updateTenantSchema), async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { name, slug, isActive } = req.body;

    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    if (slug && slug !== existing.slug) {
      const slugTaken = await prisma.tenant.findUnique({ where: { slug } });
      if (slugTaken) {
        res.status(400).json({ error: 'Slug already in use by another operator' });
        return;
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ message: 'Operator updated successfully', tenant: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update operator' });
  }
});

// 4. Delete a tenant (Operator)
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    await prisma.tenant.delete({ where: { id: tenantId } });
    res.json({ message: 'Operator and all associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete operator. They might have active data.' });
  }
});

// 5. Create a Login for a specific Operator
router.post('/:id/create-login', validate(createTenantLoginSchema), async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { email, password } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email is already in use by another account' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'TENANT_OWNER',
        tenantId,
      },
    });

    res.status(201).json({
      message: 'Operator login created successfully',
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create login' });
  }
});

export default router;
