import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './config/database';
import { pool } from './config/database';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import routerRoutes from './routes/routers';
import packageRoutes from './routes/packages';
import voucherRoutes from './routes/vouchers';
import portalRoutes from './routes/portal';
import paymentRoutes from './routes/payments';
import statsRoutes from './routes/stats';
import applicationRoutes from './routes/applications';
import { VoucherCleanupService } from './services/cron/VoucherCleanupService';

const app = express();
const allowedOrigins = new Set(
  env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without Origin (e.g. health checks or server-to-server calls) are allowed.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/routers', routerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/applications', applicationRoutes);

// Liveness means the process is running; it deliberately does not depend on the DB.
app.get('/api/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'PoaFi API' });
});

// Readiness checks whether this instance can reach PostgreSQL.
app.get('/api/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

// Backwards-compatible health endpoint.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PoaFi API', timestamp: new Date() });
});

const server = app.listen(env.PORT, () => {
  console.log(`PoaFi API listening on port ${env.PORT} (${env.NODE_ENV})`);

  // Keep this disabled on API replicas. Run exactly one cleanup worker until
  // a distributed lock/queue-based scheduler is implemented.
  if (env.RUN_VOUCHER_CLEANUP) {
    VoucherCleanupService.startBackgroundJob(60000);
  }
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received; shutting down gracefully`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('[server] Error during shutdown', error);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
