// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: false,
});

pool.on('error', (error) => {
  // Do not log connection strings or credentials.
  console.error('[database] Unexpected idle PostgreSQL client error', error.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
