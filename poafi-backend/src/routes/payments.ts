import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { isPaymentSimulationAllowed } from '../services/payment/paymentSafety';
import { validate } from '../middleware/validate';
import { PaymentService } from '../services/payment/PaymentService';
import {
  AzamPayGateway,
  UnauthorizedWebhookError,
  WebhookNotConfiguredError,
} from '../services/payment/AzamPayGateway';
import { encryptSecret } from '../utils/crypto';
import { env } from '../config/env';
import {
  PAYMENT_GATEWAY_CATALOG,
  getCatalogEntry,
  decryptStoredCredentials,
  encryptCredentials,
  testGatewayConnection,
  ensureTenantDefaultGateway,
  PaymentGatewayProviderId,
} from '../services/payment/PaymentGatewayCatalog';
import {
  calculateSubscriptionPriceTzs,
  getSubscriptionPlan,
  getTenantSubscriptionSummary,
} from '../services/payment/SubscriptionPlans';

const router = Router();

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

// Captive Portal polls for payment confirmation using the per-payment secret
// returned by checkout. Header only — never URL query (leaks in logs, referer).
router.get('/:id/status', async (req, res) => {
  try {
    const accessToken = req.header('X-Payment-Access-Token');
    if (typeof accessToken !== 'string' || accessToken.length < 32) {
      res.status(401).json({ error: 'Payment access token required' });
      return;
    }

    const status = await PaymentService.getPaymentStatus(req.params.id, accessToken);
    res.json(status);
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Payment not found' });
  }
});

// Development-only simulation. Gated by isPaymentSimulationAllowed (off in prod).
// Authorized via the same X-Payment-Access-Token used by /status — this lets the
// captive portal test the full flow without requiring admin login, while remaining
// strictly disabled when AZAMPAY_IS_LIVE=true or ALLOW_PAYMENT_SIMULATION is false.
router.post('/:id/simulate-confirm', async (req, res) => {
  try {
    if (!isPaymentSimulationAllowed(env.NODE_ENV, env.ALLOW_PAYMENT_SIMULATION, env.AZAMPAY_IS_LIVE)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const accessToken = req.header('X-Payment-Access-Token');
    if (typeof accessToken !== 'string' || accessToken.length < 32) {
      res.status(401).json({ error: 'Payment access token required' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, accessTokenHash: tokenHash },
      select: { id: true },
    });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const result = await PaymentService.simulateConfirmation(req.params.id);
    res.json({
      message: 'Payment confirmed and voucher issued. Follow the access instructions shown by the portal.',
      voucherCode: result.rawCode,
      accessMode: result.accessMode,
      voucherStatus: result.voucher.status,
      status: 'SUCCESS',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Simulation failed' });
  }
});

// Verified webhook endpoint: requires HMAC-SHA256 signature verified against tenant or platform webhookSecret.
// Fails closed (503) if no webhook secret is configured; rejects bad/missing signatures (401).
router.post('/webhook', async (req: any, res) => {
  try {
    const signature =
      (req.headers['x-azampay-signature'] as string | undefined) ||
      (req.headers['x-webhook-signature'] as string | undefined);
    const result = await PaymentService.handleWebhook(req.body, signature, req.rawBody);
    res.json(result);
  } catch (error: any) {
    if (error instanceof WebhookNotConfiguredError) {
      res.status(503).json({ error: error.message });
      return;
    }
    if (error instanceof UnauthorizedWebhookError) {
      res.status(401).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});

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

router.post('/config', requireAuth, validate(configSchema), async (req, res) => {
  try {
    const { tenantId, provider, appName, clientId, apiKey, clientSecret, webhookSecret, isLive } = req.body;

    if (req.user?.role !== 'PLATFORM_ADMIN' && req.user?.tenantId !== tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;
    const encryptedSecret = clientSecret ? encryptSecret(clientSecret) : undefined;

    await prisma.paymentConfig.upsert({
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

function resolveTargetTenantId(req: any): string | null {
  if (req.user?.role === 'PLATFORM_ADMIN') {
    const requested = (req.body?.tenantId || req.query?.tenantId) as string | undefined;
    if (requested) return requested;
  }
  return req.user?.tenantId || null;
}

// 1. Get checkout mode + all payment gateways for the active tenant
router.get('/gateways', requireAuth, async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    await ensureTenantDefaultGateway(tenantId);

    const [tenant, settings, legacyConfig, subscription] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, paymentMode: true },
      }),
      prisma.paymentGatewaySetting.findMany({ where: { tenantId } }),
      prisma.paymentConfig.findUnique({ where: { tenantId } }),
      getTenantSubscriptionSummary(tenantId),
    ]);

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const settingsByProvider = new Map(settings.map((s) => [s.provider, s]));

    const gateways = PAYMENT_GATEWAY_CATALOG.map((entry) => {
      const saved = settingsByProvider.get(entry.id);
      const creds = decryptStoredCredentials(saved?.encryptedCredentials);

      // Migrate display awareness for tenants that previously used legacy PaymentConfig
      if (entry.id === 'AZAMPAY' && !saved && legacyConfig?.encryptedSecret) {
        creds.appName = legacyConfig.appName || '';
        creds.clientId = legacyConfig.clientId || '';
      }

      const nonSecretValues: Record<string, string> = {};
      const configuredFields: string[] = [];

      for (const f of entry.fields) {
        const val = creds[f.key];
        if (typeof val === 'string' && val.trim().length > 0) {
          configuredFields.push(f.key);
          if (!f.secret) {
            nonSecretValues[f.key] = val;
          }
        }
      }

      const requiredFields = entry.fields.filter((f) => !f.optional);
      const hasRequiredCredentials =
        entry.isPlatformManaged ||
        requiredFields.every((f) => configuredFields.includes(f.key)) ||
        (entry.id === 'AZAMPAY' && !saved && Boolean(legacyConfig?.encryptedSecret));

      return {
        ...entry,
        isEnabled: saved ? saved.isEnabled : entry.id === 'POAFI_PAY',
        environment: (saved?.environment as 'PRODUCTION' | 'SANDBOX') || 'PRODUCTION',
        hasCredentials: hasRequiredCredentials,
        configuredFields,
        nonSecretValues,
        lastTestedAt: saved?.lastTestedAt || null,
        lastTestStatus: saved?.lastTestStatus || null,
        lastTestMessage: saved?.lastTestMessage || null,
      };
    });

    res.json({
      paymentMode: tenant.paymentMode,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      activeCount: gateways.filter((g) => g.isEnabled).length,
      subscription,
      gateways,
    });
  } catch (error) {
    console.error('Fetch gateways error:', error);
    res.status(500).json({ error: 'Failed to load payment gateways' });
  }
});

// 2. Update hotspot checkout method (MOBILE_ONLY, MIXED, VOUCHER_ONLY)
const checkoutModeSchema = z.object({
  paymentMode: z.enum(['MOBILE_ONLY', 'MIXED', 'VOUCHER_ONLY']),
});

router.patch('/checkout-mode', requireAuth, validate(checkoutModeSchema), async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { paymentMode: req.body.paymentMode },
      select: { paymentMode: true },
    });

    res.json({
      message: 'Hotspot checkout method updated successfully',
      paymentMode: updated.paymentMode,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update checkout method' });
  }
});

// 3. Save / update gateway credentials + optional enable
const saveGatewaySchema = z.object({
  environment: z.enum(['PRODUCTION', 'SANDBOX']).default('PRODUCTION'),
  credentials: z.record(z.string(), z.string()).optional(),
  enable: z.boolean().optional(),
});

router.put('/gateways/:provider', requireAuth, validate(saveGatewaySchema), async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const providerId = req.params.provider.toUpperCase() as PaymentGatewayProviderId;
    const entry = getCatalogEntry(providerId);
    if (!entry) {
      res.status(404).json({ error: 'Unknown payment gateway provider' });
      return;
    }

    const existing = await prisma.paymentGatewaySetting.findUnique({
      where: { tenantId_provider: { tenantId, provider: providerId } },
    });

    const mergedCreds = decryptStoredCredentials(existing?.encryptedCredentials);
    const incoming = req.body.credentials || {};
    for (const field of entry.fields) {
      if (typeof incoming[field.key] === 'string') {
        const trimmed = incoming[field.key].trim();
        if (trimmed.length > 0) {
          mergedCreds[field.key] = trimmed;
        } else if (!field.secret) {
          delete mergedCreds[field.key];
        }
      }
    }

    const requiredFields = entry.fields.filter((f) => !f.optional);
    const missingRequired = requiredFields.filter((f) => !mergedCreds[f.key]?.trim());

    if (req.body.enable && !entry.isPlatformManaged && missingRequired.length > 0) {
      res.status(400).json({
        error: `Please provide all required fields before enabling ${entry.name}: ${missingRequired.map((f) => f.labelEn).join(', ')}`,
      });
      return;
    }

    if (req.body.enable && !entry.isPlatformManaged) {
      const sub = await getTenantSubscriptionSummary(tenantId);
      if (!sub.isActive) {
        res.status(402).json({
          error: `Monthly Subscription required to enable ${entry.name} (0% PoaFi commission). Please activate a subscription plan below, or click "Save without enabling" to store your keys first.`,
          requiresSubscription: true,
        });
        return;
      }
      if (!sub.coversCurrentSites) {
        res.status(402).json({
          error: `Your current subscription covers up to ${sub.maxSitesAllowed} site(s), but you have ${sub.effectiveSiteCount} sites. Please upgrade to the Multi-Site Business or Enterprise plan below.`,
          requiresSubscription: true,
        });
        return;
      }
    }

    const encryptedCredentials = entry.isPlatformManaged ? null : encryptCredentials(mergedCreds);

    const saved = await prisma.paymentGatewaySetting.upsert({
      where: { tenantId_provider: { tenantId, provider: providerId } },
      create: {
        tenantId,
        provider: providerId,
        environment: req.body.environment,
        encryptedCredentials,
        isEnabled: Boolean(req.body.enable),
      },
      update: {
        environment: req.body.environment,
        ...(encryptedCredentials !== null && { encryptedCredentials }),
        ...(typeof req.body.enable === 'boolean' && { isEnabled: req.body.enable }),
      },
    });

    // Keep legacy PaymentConfig synchronized for AZAMPAY so webhooks and PaymentService align
    if (providerId === 'AZAMPAY' && mergedCreds.clientId && mergedCreds.clientSecret) {
      await prisma.paymentConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          provider: 'AZAMPAY',
          appName: mergedCreds.appName || null,
          clientId: mergedCreds.clientId,
          encryptedApiKey: mergedCreds.apiKey ? encryptSecret(mergedCreds.apiKey) : null,
          encryptedSecret: encryptSecret(mergedCreds.clientSecret),
          webhookSecret: mergedCreds.webhookSecret || null,
          isLive: req.body.environment === 'PRODUCTION',
        },
        update: {
          provider: 'AZAMPAY',
          appName: mergedCreds.appName || null,
          clientId: mergedCreds.clientId,
          ...(mergedCreds.apiKey && { encryptedApiKey: encryptSecret(mergedCreds.apiKey) }),
          encryptedSecret: encryptSecret(mergedCreds.clientSecret),
          ...(mergedCreds.webhookSecret && { webhookSecret: mergedCreds.webhookSecret }),
          isLive: req.body.environment === 'PRODUCTION',
        },
      });
    }

    res.json({
      message: `${entry.name} settings saved successfully`,
      isEnabled: saved.isEnabled,
      environment: saved.environment,
    });
  } catch (error) {
    console.error('Save gateway error:', error);
    res.status(500).json({ error: 'Failed to save payment gateway settings' });
  }
});

// 4. Toggle a gateway on/off
const toggleGatewaySchema = z.object({
  enabled: z.boolean(),
});

router.post('/gateways/:provider/toggle', requireAuth, validate(toggleGatewaySchema), async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const providerId = req.params.provider.toUpperCase() as PaymentGatewayProviderId;
    const entry = getCatalogEntry(providerId);
    if (!entry) {
      res.status(404).json({ error: 'Unknown payment gateway provider' });
      return;
    }

    await ensureTenantDefaultGateway(tenantId);

    const existing = await prisma.paymentGatewaySetting.findUnique({
      where: { tenantId_provider: { tenantId, provider: providerId } },
    });

    if (req.body.enabled && !entry.isPlatformManaged) {
      const creds = decryptStoredCredentials(existing?.encryptedCredentials);
      const requiredFields = entry.fields.filter((f) => !f.optional);
      const missingRequired = requiredFields.filter((f) => !creds[f.key]?.trim());
      if (missingRequired.length > 0) {
        res.status(400).json({
          error: `Setup required: save credentials for ${entry.name} before enabling it.`,
        });
        return;
      }

      const sub = await getTenantSubscriptionSummary(tenantId);
      if (!sub.isActive) {
        res.status(402).json({
          error: `Monthly Subscription required to enable ${entry.name} (0% PoaFi commission). Subscribe to a monthly plan on this page or use PoaFi Pay for free.`,
          requiresSubscription: true,
        });
        return;
      }
      if (!sub.coversCurrentSites) {
        res.status(402).json({
          error: `Your current subscription covers up to ${sub.maxSitesAllowed} site(s), but you have ${sub.effectiveSiteCount} sites. Please upgrade to the Multi-Site Business or Enterprise plan.`,
          requiresSubscription: true,
        });
        return;
      }
    }

    const updated = await prisma.paymentGatewaySetting.upsert({
      where: { tenantId_provider: { tenantId, provider: providerId } },
      create: {
        tenantId,
        provider: providerId,
        isEnabled: req.body.enabled,
        environment: 'PRODUCTION',
      },
      update: { isEnabled: req.body.enabled },
    });

    res.json({
      message: `${entry.name} ${updated.isEnabled ? 'enabled' : 'disabled'}`,
      isEnabled: updated.isEnabled,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle payment gateway' });
  }
});

// 5. Test gateway connection (uses submitted credentials OR saved encrypted credentials)
router.post('/gateways/:provider/test', requireAuth, async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const providerId = req.params.provider.toUpperCase() as PaymentGatewayProviderId;
    const entry = getCatalogEntry(providerId);
    if (!entry) {
      res.status(404).json({ error: 'Unknown payment gateway provider' });
      return;
    }

    const existing = await prisma.paymentGatewaySetting.findUnique({
      where: { tenantId_provider: { tenantId, provider: providerId } },
    });

    const creds = decryptStoredCredentials(existing?.encryptedCredentials);
    const incoming = req.body?.credentials || {};
    for (const field of entry.fields) {
      if (typeof incoming[field.key] === 'string' && incoming[field.key].trim().length > 0) {
        creds[field.key] = incoming[field.key].trim();
      }
    }

    const environment =
      req.body?.environment === 'SANDBOX' || existing?.environment === 'SANDBOX'
        ? 'SANDBOX'
        : 'PRODUCTION';

    const result = await testGatewayConnection(providerId, environment, creds);
    const testedAt = new Date();

    await prisma.paymentGatewaySetting.upsert({
      where: { tenantId_provider: { tenantId, provider: providerId } },
      create: {
        tenantId,
        provider: providerId,
        isEnabled: entry.isPlatformManaged,
        environment,
        lastTestedAt: testedAt,
        lastTestStatus: result.ok ? 'OK' : 'FAILED',
        lastTestMessage: result.message,
      },
      update: {
        lastTestedAt: testedAt,
        lastTestStatus: result.ok ? 'OK' : 'FAILED',
        lastTestMessage: result.message,
      },
    });

    res.status(result.ok ? 200 : 400).json({
      ok: result.ok,
      message: result.message,
      testedAt: testedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Connection test failed' });
  }
});

// 6. Request a new payment gateway provider
const requestGatewaySchema = z.object({
  providerName: z.string().min(2).max(80),
  country: z.string().max(60).optional(),
  notes: z.string().max(400).optional(),
});

router.post('/gateways/request', requireAuth, validate(requestGatewaySchema), async (req, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant access required' });
    return;
  }

  console.log(
    `[GatewayRequest] tenant=${tenantId} user=${req.user?.email} provider="${req.body.providerName}" country="${req.body.country || 'TZ'}" notes="${req.body.notes || ''}"`,
  );

  res.status(201).json({
    message: `Thank you! Your request for "${req.body.providerName}" has been logged for the PoaFi integration team.`,
  });
});

// ---------------------------------------------------------------------------
// 7. Operator Monthly Subscriptions (for Custom Direct Payment Gateways & Multi-Site)
// ---------------------------------------------------------------------------

router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const [subscription, history] = await Promise.all([
      getTenantSubscriptionSummary(tenantId),
      (prisma as any).subscriptionPayment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({ subscription, history });
  } catch (error) {
    console.error('Fetch subscription error:', error);
    res.status(500).json({ error: 'Failed to load subscription details' });
  }
});

const subscriptionCheckoutSchema = z.object({
  planId: z.enum(['STARTER_1_SITE', 'GROWTH_MULTI_SITE', 'ENTERPRISE_UNLIMITED']),
  months: z.coerce.number().int().refine((m) => [1, 3, 12].includes(m), {
    message: 'Billing cycle must be 1, 3, or 12 months',
  }).default(1),
  phoneNumber: z.string().min(9, 'Valid mobile money phone number is required'),
  provider: z.enum(['MPESA', 'TIGOPESA', 'AIRTEL', 'HALOPESA']).default('MPESA'),
  tenantId: z.string().uuid().optional(),
});

router.post('/subscription/checkout', requireAuth, validate(subscriptionCheckoutSchema), async (req, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const { planId, months, phoneNumber, provider } = req.body;
    const plan = getSubscriptionPlan(planId);
    if (!plan) {
      res.status(400).json({ error: 'Invalid subscription plan' });
      return;
    }

    const currentSub = await getTenantSubscriptionSummary(tenantId);
    if (plan.maxSites < currentSub.effectiveSiteCount) {
      res.status(400).json({
        error: `You currently have ${currentSub.effectiveSiteCount} Wi-Fi sites, which exceeds the ${plan.nameEn} limit (${plan.maxSites} site). Please select a Multi-Site plan that covers at least ${currentSub.effectiveSiteCount} sites.`,
      });
      return;
    }

    const amountTzs = calculateSubscriptionPriceTzs(planId, months);
    const masterGateway = new AzamPayGateway({
      appName: env.AZAMPAY_APP_NAME || 'POAFI_MASTER',
      clientId: env.AZAMPAY_CLIENT_ID,
      apiKey: env.AZAMPAY_API_KEY || '',
      clientSecret: env.AZAMPAY_CLIENT_SECRET,
      isLive: env.AZAMPAY_IS_LIVE,
      allowSimulation: env.ALLOW_PAYMENT_SIMULATION,
      nodeEnv: env.NODE_ENV,
    });

    const formattedPhone = masterGateway.formatTzPhone(phoneNumber);
    const reference = `SUB-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const subPayment = await (prisma as any).subscriptionPayment.create({
      data: {
        tenantId,
        planId,
        months,
        amountTzs,
        provider,
        phoneNumber: formattedPhone,
        reference,
        status: 'PENDING',
      },
    });

    const checkoutResult = await masterGateway.initiateMnoCheckout({
      reference,
      amount: amountTzs,
      phone: formattedPhone,
      provider,
    });

    if (!checkoutResult.success) {
      await (prisma as any).subscriptionPayment.update({
        where: { id: subPayment.id },
        data: { status: 'FAILED' },
      });
      res.status(400).json({ error: checkoutResult.message || 'Subscription payment initiation failed' });
      return;
    }

    if (checkoutResult.externalId) {
      await (prisma as any).subscriptionPayment.update({
        where: { id: subPayment.id },
        data: { externalId: checkoutResult.externalId },
      });
    }

    const canQuickConfirm =
      !env.AZAMPAY_IS_LIVE ||
      isPaymentSimulationAllowed(env.NODE_ENV, env.ALLOW_PAYMENT_SIMULATION, env.AZAMPAY_IS_LIVE);

    res.status(201).json({
      subscriptionPaymentId: subPayment.id,
      reference,
      planId,
      planNameEn: plan.nameEn,
      months,
      amountTzs,
      provider,
      phoneNumber: formattedPhone,
      externalId: checkoutResult.externalId,
      status: 'PENDING',
      canQuickConfirm,
      message: checkoutResult.message,
    });
  } catch (error: any) {
    console.error('Subscription checkout error:', error);
    res.status(400).json({ error: error.message || 'Failed to initiate subscription checkout' });
  }
});

router.post('/subscription/:id/confirm', requireAuth, async (req, res) => {
  try {
    const subPay: any = await (prisma as any).subscriptionPayment.findUnique({
      where: { id: req.params.id },
    });
    if (!subPay) {
      res.status(404).json({ error: 'Subscription payment not found' });
      return;
    }

    if (req.user?.role !== 'PLATFORM_ADMIN' && req.user?.tenantId !== subPay.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const isAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const isSandboxOrDev =
      !env.AZAMPAY_IS_LIVE ||
      isPaymentSimulationAllowed(env.NODE_ENV, env.ALLOW_PAYMENT_SIMULATION, env.AZAMPAY_IS_LIVE);

    if (!isAdmin && !isSandboxOrDev) {
      res.status(403).json({
        error: 'Live subscription payments are confirmed automatically by the payment gateway callback.',
      });
      return;
    }

    await PaymentService.fulfillSubscriptionPayment(subPay.reference);
    const subscription = await getTenantSubscriptionSummary(subPay.tenantId);

    res.json({
      message: `Subscription activated! You can now enable and use your own direct payment gateways with 0% PoaFi commission.`,
      subscription,
    });
  } catch (error: any) {
    console.error('Confirm subscription error:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm subscription' });
  }
});

const adminGrantSubSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.enum(['STARTER_1_SITE', 'GROWTH_MULTI_SITE', 'ENTERPRISE_UNLIMITED']),
  months: z.coerce.number().int().min(1).max(36).default(1),
});

router.post('/subscription/admin-grant', requireAuth, validate(adminGrantSubSchema), async (req, res) => {
  try {
    if (req.user?.role !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Platform Admin access required' });
      return;
    }

    const { tenantId, planId, months } = req.body;
    const plan = getSubscriptionPlan(planId);
    if (!plan) {
      res.status(400).json({ error: 'Invalid subscription plan' });
      return;
    }

    const reference = `SUB-ADMIN-${Date.now().toString().slice(-6)}`;
    await (prisma as any).subscriptionPayment.create({
      data: {
        tenantId,
        planId,
        months,
        amountTzs: calculateSubscriptionPriceTzs(planId, months),
        provider: 'ADMIN_GRANT',
        phoneNumber: 'ADMIN',
        reference,
        status: 'PENDING',
      },
    });

    await PaymentService.fulfillSubscriptionPayment(reference, 'ADMIN_GRANT');
    const subscription = await getTenantSubscriptionSummary(tenantId);

    res.json({
      message: `Granted ${plan.nameEn} (${months} month(s)) to operator.`,
      subscription,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to grant subscription' });
  }
});

export default router;