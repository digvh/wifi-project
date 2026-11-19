import * as dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(32),

  // Environment + payment safety controls (added by the payment-safety hardening)
  NODE_ENV: z.string().default('development'),
  ALLOW_PAYMENT_SIMULATION: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(false),

  // Optional FreeRADIUS bridge. Keep disabled until the separate RADIUS
  // service is deployed and its internal shared secret is configured.
  RADIUS_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  RADIUS_SERVER_HOST: z.string().optional(),
  RADIUS_REST_SHARED_SECRET: z.string().min(32).optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  // Public HTTPS URL of this API, reachable from routers (used by the enrollment phone-home)
  PUBLIC_API_URL: z.string().url().optional(),
  // Comma-separated allowed CORS origins for production (e.g. https://poafi.com,https://app.poafi.com)
  CORS_ORIGIN: z.string().optional(),

  // Platform Master Payment Gateway (Mode B: Central Aggregation)
  AZAMPAY_APP_NAME: z.string().optional(),
  AZAMPAY_CLIENT_ID: z.string().optional(),
  AZAMPAY_API_KEY: z.string().optional(),
  AZAMPAY_CLIENT_SECRET: z.string().optional(),
  AZAMPAY_WEBHOOK_SECRET: z.string().optional(),
  AZAMPAY_IS_LIVE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  // Optional Beem Africa SMS Gateway (Tanzania)
  BEEM_API_KEY: z.string().optional(),
  BEEM_SECRET_KEY: z.string().optional(),
  BEEM_SENDER_ID: z.string().default('POAFI'),

  // Platform Commission % for Mode B (e.g. 10 = You keep 10%, Operator gets 90%)
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(10),

  // WireGuard Cloud VPN Configuration
  WG_SERVER_ENDPOINT: z.string().optional(),
  WG_SERVER_PUBLIC_KEY: z.string().optional(),
  WG_SERVER_IP: z.string().optional(),

  // Shared hosting (cPanel / Passenger) support
  // Number of reverse-proxy hops to trust for client IPs (Passenger/Apache/Cloudflare = 1).
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  // Set to false on shared hosting where processes are put to sleep; use the cron endpoint instead.
  BACKGROUND_JOBS: z.preprocess((val) => val === undefined || val === '' ? true : val === 'true' || val === true, z.boolean()).default(true),
  // Secret for GET/POST /api/internal/cron/run (called by cPanel Cron Jobs). Min 32 chars.
  CRON_SECRET: z.string().min(32).optional(),
  // Database pool size (keep low, e.g. 5, on shared hosting / free cloud Postgres)
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  // Enable TLS for remote PostgreSQL hosts (auto-detected if DATABASE_URL has sslmode=require)
  DB_SSL: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  // Cookie settings for same-domain or cross-domain shared hosting deployments
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  // Optional path to static exported frontend (defaults to ./public or ../poafi-frontend/out if present)
  STATIC_FRONTEND_DIR: z.string().optional(),
});

export const env = envSchema.parse(process.env);