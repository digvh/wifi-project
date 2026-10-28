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
  message: z.string().max(1000).optional(),
});

const approveApplicationSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const rejectApplicationSchema = z.object({
  note: z.string().min(3, 'Rejection note required').max(500),
});

// Rate limiter for public application submissions
const applicationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many applications submitted from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/applications — Public: Submit operator application
router.post('/', applicationRateLimiter, validate(submitApplicationSchema), async (req, res) => {
  try {
    const { businessName, contactName, email, phone, city, message } = req.body;

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

    const application = await prisma.operatorApplication.create({
      data: {
        businessName,
        contactName,
        email,
        phone,
        city,
        message: message || '',
      },
    });

    res.status(201).json({
      message: 'Hongera! Ombi lako limepokelewa kikamilifu. Timu ya PoaFi itawasiliana nawe ndani ya saa 24. / Application submitted successfully! We will contact you within 24 hours.',
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
    res.json({ applications });
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
    res.json({ application: app });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// POST /api/applications/:id/approve — Super Admin: Approve and create Tenant + User Login
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

    const { password } = req.body;

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

    const passwordHash = await hashPassword(password);

    // Create tenant + operator user + update application status in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: app.businessName,
          slug: finalSlug,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: app.email,
          passwordHash,
          role: 'TENANT_OWNER',
          tenantId: tenant.id,
        },
      });

      const updatedApp = await tx.operatorApplication.update({
        where: { id: app.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      return { tenant, user, application: updatedApp };
    });

    res.json({
      message: `Operator account approved and created successfully for ${app.businessName}!`,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      user: {
        email: result.user.email,
        role: result.user.role,
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

