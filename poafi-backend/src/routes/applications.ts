import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
import { hashPassword } from '../utils/auth';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import rateLimit from 'express-rate-limit';

const router = Router();

const submitApplicationSchema = z.object({
  businessName: z.string().min(2, 'Business name too short').max(100),
  contactName: z.string().min(2, 'Contact name too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number too short').max(20),
  city: z.string().min(2, 'City required').max(100),
  password: z.string().min(8, 'Nenosiri lazima liwe na angalau herufi 8 / Password must be at least 8 characters').optional(),
  message: z.string().max(1000).optional(),
});

const approveApplicationSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

const rejectApplicationSchema = z.object({
  note: z.string().min(3, 'Rejection note required').max(500),
});

// Rate limiter for public application submissions
const applicationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Too many applications submitted from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/applications — Public: Submit operator application (with operator's own password)
router.post('/', applicationRateLimiter, validate(submitApplicationSchema), async (req, res) => {
  try {
    const { businessName, contactName, email, phone, city, password, message } = req.body;

    const existing = await prisma.operatorApplication.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'PENDING') {
        res.status(400).json({ error: 'Ombi lako limepokelewa tayari na linashughulikiwa. / An application with this email is already under review.' });
        return;
      }
      if (existing.status === 'APPROVED') {
        res.status(400).json({ error: 'Akaunti hii tayari imesajiliwa. Tafadhali ingia kwenye mfumo. / An account is already registered with this email. Please log in.' });
        return;
      }
    }

    // Check if user email already exists in User table
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Akaunti yenye barua pepe hii tayari ipo. Tafadhali ingia kwenye mfumo. / User with this email already exists. Please log in.' });
      return;
    }

    let passwordHash: string | null = null;
    if (password && password.trim().length >= 8) {
      passwordHash = await hashPassword(password.trim());
    }

    const application = await prisma.operatorApplication.create({
      data: {
        businessName,
        contactName,
        email,
        phone,
        city,
        passwordHash,
        message: message || '',
      },
    });

    res.status(201).json({
      message: 'Hongera! Ombi lako na nenosiri lako vimerekodiwa kikamilifu. Akaunti yako itawashwa mara moja baada ya ukaguzi. / Application submitted successfully! Your account will be activated with your chosen password.',
      id: application.id,
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ error: 'Imeshindwa kutuma ombi / Failed to submit application' });
  }
});

// GET /api/applications — Super Admin: List all applications
router.get('/', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const applications = await prisma.operatorApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const safeApps = applications.map(({ passwordHash, ...app }) => ({
      ...app,
      hasPassword: Boolean(passwordHash),
    }));

    res.json({ applications: safeApps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/applications/:id — Super Admin: Get single application
router.get('/:id', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const app = await prisma.operatorApplication.findUnique({ where: { id: req.params.id } });
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const { passwordHash, ...safeApp } = app;
    res.json({ application: { ...safeApp, hasPassword: Boolean(passwordHash) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// POST /api/applications/:id/approve — Super Admin: Approve and create Tenant + User Login + Initial Site
router.post('/:id/approve', requireAuth, requirePlatformAdmin, validate(approveApplicationSchema), async (req, res) => {
  try {
    const app = await prisma.operatorApplication.findUnique({ where: { id: req.params.id } });
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    if (app.status !== 'PENDING') {
      res.status(400).json({ error: `Application is already ${app.status}` });
      return;
    }

    // Determine password: admin override OR operator's chosen password
    let finalPasswordHash = app.passwordHash;
    if (req.body.password && req.body.password.trim().length >= 8) {
      finalPasswordHash = await hashPassword(req.body.password.trim());
    }

    if (!finalPasswordHash) {
      // Fallback if neither was set
      finalPasswordHash = await hashPassword('PoaFiPass2026!');
    }

    // Generate unique slug from business name
    const baseSlug = app.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40) || 'operator';

    let finalSlug = baseSlug;
    let counter = 1;
    while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    // Check if user email already exists in User table
    const existingUser = await prisma.user.findUnique({ where: { email: app.email } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists in system' });
      return;
    }

    // Create tenant + operator user + default physical site + update application status in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: app.businessName,
          slug: finalSlug,
          isActive: true,
          paymentMode: 'MIXED',
        },
      });

      const user = await tx.user.create({
        data: {
          email: app.email,
          passwordHash: finalPasswordHash,
          role: 'TENANT_OWNER',
          tenantId: tenant.id,
        },
      });

      // AUTO-CREATE INITIAL SITE using application details (No re-typing needed!)
      const defaultSite = await (tx as any).site.create({
        data: {
          tenantId: tenant.id,
          name: `${app.businessName} (Main Site)`,
          address: app.city,
        },
      });

      const updatedApp = await tx.operatorApplication.update({
        where: { id: app.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      return { tenant, user, site: defaultSite, application: updatedApp };
    });

    res.json({
      message: `Operator account approved successfully! Workspace, operator login, and main site (${app.city}) created.`,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      user: {
        email: result.user.email,
        role: result.user.role,
      },
      site: {
        id: result.site.id,
        name: result.site.name,
        address: result.site.address,
      },
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

// POST /api/applications/:id/reject — Super Admin: Reject application with reason
router.post('/:id/reject', requireAuth, requirePlatformAdmin, validate(rejectApplicationSchema), async (req, res) => {
  try {
    const app = await prisma.operatorApplication.findUnique({ where: { id: req.params.id } });
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    if (app.status !== 'PENDING') {
      res.status(400).json({ error: `Application is already ${app.status}` });
      return;
    }

    await prisma.operatorApplication.update({
      where: { id: app.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewNote: req.body.note,
      },
    });

    res.json({ message: 'Application marked as rejected.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

export default router;
