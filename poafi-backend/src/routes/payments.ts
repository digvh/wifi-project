import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../config/database';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';
import { env } from '../config/env';
import { validate } from '../middleware/validate';
import { PaymentService } from '../services/payment/PaymentService';
import { encryptSecret } from '../utils/crypto';

const router = Router();

// Rate limiter for checkout attempts (max 15 per 15 min per IP)
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many checkout attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkoutSchema = z.object({
  tenantSlug: z.string().min(1, 'Operator identifier is required'),
  packageId: z.string().uuid('Invalid package ID'),
  phoneNumber: z.string().min(9, 'Valid phone number is required'),
  provider: z.enum(['MPESA', 'TIGOPESA', 'AIRTEL', 'HALOPESA', 'CARD', 'AZAMPAY']).default('MPESA'),
});

const configSchema = z.object({
  tenantId: z.string().uuid(),
  provider: z.string().default('AZAMPAY'),
  appName: z.string().optional(),
  clientId: z.string().optional(),
  apiKey: z.string().optional(),
  clientSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  isLive: z.boolean().default(false),
});

// 1. Customer initiates Mobile Money payment from Captive Portal
router.post('/checkout', checkoutLimiter, validate(checkoutSchema), async (req, res) => {
  try {
    const { tenantSlug, packageId, phoneNumber, provider } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;

    const result = await PaymentService.initiateCheckout({
      tenantId: tenant.id,
      packageId,
      phoneNumber,
      provider,
      clientIp: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : undefined,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(400).json({ error: error.message || 'Payment initiation failed' });
  }
});

// 2. Captive Portal polls for payment confirmation
router.get('/:id/status', async (req, res) => {
  try {
    const status = await PaymentService.getPaymentStatus(
      req.params.id,
      req.get('x-payment-access-token'),
    );
    res.json(status);
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Payment not found' });
  }
});

// 3. Testing / Simulation endpoint: simulate user entering PIN on their phone
router.post('/:id/simulate-confirm', requireAuth, requirePlatformAdmin, async (req, res) => {
  // Simulation must never be usable in production; real payment confirmation comes from a verified provider.
  if (env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const result = await PaymentService.simulateConfirmation(req.params.id);
    res.json({
      message: 'Payment confirmed and Wi-Fi access provisioned!',
      voucherCode: result.rawCode,
      status: 'SUCCESS',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Simulation failed' });
  }
});

// 4. Public Webhook callback from AzamPay / Telco
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-azampay-signature'] as string | undefined;
    const result = await PaymentService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (error: any) {
    console.error('Payment webhook error:', error);
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});

// 5. Operator / Admin: View payment transactions with pagination & revenue totals
router.get('/', requireAuth, async (req, res) => {
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
      whereClause.status = (req.query.status as string).toUpperCase();
    }

    if (req.query.provider) {
      whereClause.provider = (req.query.provider as string).toUpperCase();
    }

    const [payments, total, totalRevenueAgg] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          package: { select: { name: true, durationMinutes: true } },
          tenant: { select: { name: true, slug: true } },
          voucher: { select: { status: true, activatedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
      prisma.payment.aggregate({
        where: { ...whereClause, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      payments,
      summary: {
        totalRevenueTzs: totalRevenueAgg._sum.amount || 0,
        totalTransactions: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// 6. Save Payment Gateway configuration
router.post('/config', requireAuth, validate(configSchema), async (req, res) => {
  try {
    const { tenantId, provider, appName, clientId, apiKey, clientSecret, webhookSecret, isLive } = req.body;

    if (req.user?.role !== 'PLATFORM_ADMIN' && req.user?.tenantId !== tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;
    const encryptedSecret = clientSecret ? encryptSecret(clientSecret) : undefined;

    const config = await prisma.paymentConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: provider || 'AZAMPAY',
        appName,
        clientId,
        encryptedApiKey,
        encryptedSecret,
        webhookSecret,
        isLive: isLive || false,
      },
      update: {
        provider: provider || 'AZAMPAY',
        ...(appName !== undefined && { appName }),
        ...(clientId !== undefined && { clientId }),
        ...(encryptedApiKey && { encryptedApiKey }),
        ...(encryptedSecret && { encryptedSecret }),
        ...(webhookSecret !== undefined && { webhookSecret }),
        ...(isLive !== undefined && { isLive }),
      },
    });

    res.json({ message: 'Payment gateway configuration saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save payment configuration' });
  }
});

export default router;

