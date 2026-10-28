import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { encryptSecret } from '../utils/crypto';
import { validate } from '../middleware/validate';
import { generateVouchersSchema } from '../validators';

const router = Router();
router.use(requireAuth);

// Get vouchers for tenant with pagination & filtering
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

    if (req.query.status) {
      whereClause.status = req.query.status as string;
    }

    if (req.query.batchId) {
      whereClause.batchId = req.query.batchId as string;
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where: whereClause,
        include: {
          package: { select: { id: true, name: true, priceTzs: true, durationMinutes: true } },
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.voucher.count({ where: whereClause }),
    ]);

    res.json({
      vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});

// Generate a batch of vouchers
router.post('/generate', validate(generateVouchersSchema), async (req, res) => {
  try {
    const { packageId, quantity } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(403).json({ error: 'Tenant operator context required' });
      return;
    }

    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.tenantId !== tenantId) {
      res.status(404).json({ error: 'Package not found for this operator' });
      return;
    }

    const batchId = crypto.randomUUID();
    const generatedCodes: string[] = [];
    const vouchersData = [];

    const count = parseInt(quantity);
    for (let i = 0; i < count; i++) {
      // 8-character uppercase hex code
      const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
      const encryptedCode = encryptSecret(rawCode);

      vouchersData.push({
        batchId,
        tenantId,
        packageId,
        codeHash,
        encryptedCode,
        status: 'UNUSED',
      });

      generatedCodes.push(rawCode);
    }

    await prisma.voucher.createMany({
      data: vouchersData,
    });

    res.status(201).json({
      message: 'Vouchers generated successfully',
      batchId,
      codes: generatedCodes,
      count: generatedCodes.length,
      packageName: pkg.name,
      price: pkg.priceTzs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate vouchers' });
  }
});

// Delete an entire batch of vouchers
router.delete('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const whereClause: any = { batchId };

    if (req.user?.role !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = req.user?.tenantId;
    }

    const deleted = await prisma.voucher.deleteMany({
      where: whereClause,
    });

    res.json({ message: `Batch deleted successfully (${deleted.count} vouchers removed)` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete voucher batch' });
  }
});

export default router;
