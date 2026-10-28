import * as dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(5),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  JWT_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000,http://192.168.56.1:3000'),
  RUN_VOUCHER_CLEANUP: z.preprocess(
    (value) => value === undefined ? true : value === 'true' || value === true,
    z.boolean(),
  ),

  // Platform Master Payment Gateway (Mode B: Central Aggregation)
  AZAMPAY_APP_NAME: z.string().optional(),
  AZAMPAY_CLIENT_ID: z.string().optional(),
  AZAMPAY_API_KEY: z.string().optional(),
  AZAMPAY_CLIENT_SECRET: z.string().optional(),
  AZAMPAY_IS_LIVE: z.preprocess((value) => value === 'true' || value === true, z.boolean()).default(false),

  // Platform Commission percentage, e.g. 10 = 10%
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(10),
});

export const env = envSchema.parse(process.env);
