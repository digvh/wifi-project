import * as dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(32),

  // Optional FreeRADIUS bridge. Keep disabled until the separate RADIUS
  // service is deployed and its internal shared secret is configured.
  RADIUS_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  RADIUS_SERVER_HOST: z.string().optional(),
  RADIUS_REST_SHARED_SECRET: z.string().min(32).optional(),
  PUBLIC_APP_URL: z.string().url().optional(),

  // Platform Master Payment Gateway (Mode B: Central Aggregation)
  AZAMPAY_APP_NAME: z.string().optional(),
  AZAMPAY_CLIENT_ID: z.string().optional(),
  AZAMPAY_API_KEY: z.string().optional(),
  AZAMPAY_CLIENT_SECRET: z.string().optional(),
  AZAMPAY_IS_LIVE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  // Platform Commission % for Mode B (e.g. 10 = You keep 10%, Operator gets 90%)
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(10),
});

export const env = envSchema.parse(process.env);
