import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
import { hashPassword, comparePassword, SESSION_COOKIE_NAME, sessionCookieOptions } from '../utils/auth';
import { validate } from '../middleware/validate';
import { createTenantSchema, updateTenantSchema, createTenantLoginSchema } from '../validators';

const router = Router();

/**
 * Helper to safely delete all tenant-related records in topological order
 * to avoid foreign key constraint violations across all tables.
 */
async function deleteTenantCascade(tenantId: string) {
  await prisma.$transaction(async (tx: any) => {
    // 1. Delete Radius sessions for tenant's NASes
    const nasList = await tx.radiusNas.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const nasIds = nasList.map((n: any) => n.id);
    if (nasIds.length > 0) {
      await tx.radiusSession.deleteMany({
        where: { nasId: { in: nasIds } },
      });
    }

    // 2. Delete RadiusNas records
    await tx.radiusNas.deleteMany({ where: { tenantId } });

    // 3. Delete DeviceSetupRequests
    await tx.deviceSetupRequest.deleteMany({ where: { tenantId } });

    // 4. Delete Withdrawals (if model exists)
    if (tx.withdrawal) {
      await tx.withdrawal.deleteMany({ where: { tenantId } });
    }

    // 5. Delete PayoutMethods (if model exists)
    if (tx.payoutMethod) {
      await tx.payoutMethod.deleteMany({ where: { tenantId } });
    }

    // 6. Delete Payments
    await tx.payment.deleteMany({ where: { tenantId } });

    // 7. Delete Vouchers
    await tx.voucher.deleteMany({ where: { tenantId } });

    // 8. Delete Packages
    await tx.package.deleteMany({ where: { tenantId } });

    // 9. Delete Routers
    await tx.router.deleteMany({ where: { tenantId } });

    // 10. Delete Sites (if model exists)
    if (tx.site) {
      await tx.site.deleteMany({ where: { tenantId } });
    }

    // 11. Delete PaymentConfig
    await tx.paymentConfig.deleteMany({ where: { tenantId } });

    // 12. Delete Users for this tenant
    await tx.user.deleteMany({ where: { tenantId } });

    // 13. Finally delete the Tenant
    return await tx.tenant.delete({ where: { id: tenantId } });
  });
}

// ---------------------------------------------------------------------------
// OPERATOR SELF-SERVICE ROUTES (Tenant Owner)
// ---------------------------------------------------------------------------

// Get operator's own tenant settings and profile info
router.get('/settings', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'TENANT_OWNER' || !req.user.tenantId) {
      res.status(403).json({ error: 'Only operators can access tenant settings' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      include: {
        _count: {
          select: {
            routers: true,
            packages: true,
            vouchers: true,
            sites: true,
          },
        },
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant record not found' });
      return;
    }

    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update operator's own settings (e.g., payment mode, business name)
router.patch('/settings', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'TENANT_OWNER' || !req.user.tenantId) {
      res.status(403).json({ error: 'Only operators can update their own settings' });
      return;
    }
    const { paymentMode, name, portalLogoUrl, portalColor, portalTagline, supportPhone } = req.body;
    if (paymentMode && !['MOBILE_ONLY', 'VOUCHER_ONLY', 'MIXED'].includes(paymentMode)) {
      res.status(400).json({ error: 'Invalid payment mode. Must be MOBILE_ONLY, VOUCHER_ONLY, or MIXED.' });
      return;
    }

    let safeLogoUrl: string | null | undefined = undefined;
    if (portalLogoUrl !== undefined) {
      const trimmed = String(portalLogoUrl || '').trim();
      if (!trimmed) {
        safeLogoUrl = null;
      } else {
        try {
          const parsed = new URL(trimmed);
          if (!['https:', 'http:'].includes(parsed.protocol)) {
            res.status(400).json({ error: 'Logo URL must start with https:// or http://' });
            return;
          }
          safeLogoUrl = trimmed.slice(0, 400);
        } catch {
          res.status(400).json({ error: 'Invalid Logo URL' });
          return;
        }
      }
    }

    let safeColor: string | null | undefined = undefined;
    if (portalColor !== undefined) {
      const trimmed = String(portalColor || '').trim();
      if (!trimmed) {
        safeColor = null;
      } else if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        res.status(400).json({ error: 'Portal color must be a 6-digit hex code like #00f3ff' });
        return;
      } else {
        safeColor = trimmed;
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: {
        ...(paymentMode && { paymentMode }),
        ...(name && { name: String(name).trim().slice(0, 100) }),
        ...(safeLogoUrl !== undefined && { portalLogoUrl: safeLogoUrl }),
        ...(safeColor !== undefined && { portalColor: safeColor }),
        ...(portalTagline !== undefined && {
          portalTagline: String(portalTagline || '').trim().slice(0, 120) || null,
        }),
        ...(supportPhone !== undefined && {
          supportPhone: String(supportPhone || '').trim().slice(0, 30) || null,
        }),
      } as any,
    });

    res.json({ message: 'Settings updated successfully', tenant: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Operator deletes their own account and all related hotspot data permanently
router.delete('/my-account', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'TENANT_OWNER' || !req.user.tenantId) {
      res.status(403).json({ error: 'Only registered operators can delete their account' });
      return;
    }

    const { password, confirmation } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: 'Mtumiaji hajapatikana / User account not found' });
      return;
    }

    // Require either valid password OR confirmation string 'DELETE'
    if (password) {
      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ error: 'Nenosiri si sahihi / Incorrect password' });
        return;
      }
    } else if (confirmation !== 'DELETE') {
      res.status(400).json({
        error: 'Tafadhali weka nenosiri lako au thibitisha kwa kuandika DELETE / Please provide your password or type DELETE to confirm deletion',
      });
      return;
    }

    const tenantId = req.user.tenantId;
    await deleteTenantCascade(tenantId);

    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    res.json({
      message: 'Akaunti yako na mifumo yote ya Wi-Fi imefutwa kikamilifu / Your account and all associated hotspot data have been permanently deleted',
    });
  } catch (error) {
    console.error('Self account deletion error:', error);
    res.status(500).json({ error: 'Kuna tatizo limetokea wakati wa kufuta akaunti / Failed to delete account' });
  }
});

// ---------------------------------------------------------------------------
// PLATFORM ADMIN PROTECTED ROUTES
// ---------------------------------------------------------------------------
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
          users: { select: { id: true, email: true, role: true } },
          _count: {
            select: {
              routers: true,
              packages: true,
              vouchers: true,
              users: true,
              sites: true,
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

// 4. Admin delete a tenant (Operator) and all their data
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;

    if (req.user?.tenantId === tenantId) {
      res.status(400).json({ error: 'Huwezi kufuta akaunti ya admin wako mwenyewe / Cannot delete your own admin account' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    await deleteTenantCascade(tenantId);
    res.json({ message: 'Operator and all associated data deleted successfully' });
  } catch (error) {
    console.error('Admin delete operator error:', error);
    res.status(500).json({ error: 'Failed to delete operator. Database error during cascade deletion.' });
  }
});

// Delete an individual Operator login without deleting the Operator or its business data.
router.delete('/:id/users/:userId', async (req, res) => {
  try {
    const { id: tenantId, userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) {
      res.status(404).json({ error: 'Operator login not found for this Operator' });
      return;
    }
    if (user.role === 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Platform Admin accounts cannot be deleted from Operator management' });
      return;
    }
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Operator login deleted. The Operator and its routers, packages and records were kept.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete Operator login' });
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
