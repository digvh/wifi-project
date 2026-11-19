// poafi-backend/src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from './env';

const connectionString = env.DATABASE_URL;
const needsSsl =
  env.DB_SSL ||
  /sslmode=(require|verify-full|verify-ca)/i.test(connectionString);

export const pool = new Pool({
  connectionString,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });