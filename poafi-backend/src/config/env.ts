import * as dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  // Keep existing secrets stable when encrypted values or active JWTs already exist.
  JWT_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(32),

  // PostgreSQL pool settings. Keep total across all API/worker instances below the DB limit.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(5),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  METRICS_TOKEN: z.string().min(24).optional(),
  RUN_VOUCHER_CLEANUP_IN_API: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  VOUCHER_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(10000).default(60000),

  // Platform Master Payment Gateway (Mode B: Central Aggregation)
  AZAMPAY_APP_NAME: z.string().optional(),
  AZAMPAY_CLIENT_ID: z.string().optional(),
  AZAMPAY_API_KEY: z.string().optional(),
  AZAMPAY_CLIENT_SECRET: z.string().optional(),
  AZAMPAY_IS_LIVE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(10),
});

export const env = envSchema.parse(process.env);
