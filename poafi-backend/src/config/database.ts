import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
  allowExitOnIdle: false,
});

pool.on('error', (error) => {
  console.error('[database] Unexpected idle PostgreSQL client error:', error.message);
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
