import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma, pool } from './config/database';
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
import { metricsMiddleware, renderPrometheusMetrics } from './middleware/metrics';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);

app.get('/api/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'PoaFi API', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

// Require a separate long random token and keep this endpoint private at the hosting/network layer.
app.get('/api/metrics', (req, res) => {
  if (!env.METRICS_TOKEN || req.get('authorization') !== `Bearer ${env.METRICS_TOKEN}`) {
    res.status(404).end();
    return;
  }
  res.type('text/plain; version=0.0.4; charset=utf-8').send(renderPrometheusMetrics());
});

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/routers', routerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/applications', applicationRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[http] Unhandled request error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
let cleanupTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

server.listen(env.PORT, () => {
  console.log(`PoaFi API listening on port ${env.PORT} (${env.NODE_ENV})`);
  if (env.RUN_VOUCHER_CLEANUP_IN_API) {
    cleanupTimer = VoucherCleanupService.startBackgroundJob(env.VOUCHER_CLEANUP_INTERVAL_MS);
  } else {
    console.log('[worker] Voucher cleanup disabled in API; run the dedicated worker process.');
  }
});

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received; closing server gracefully.`);
  if (cleanupTimer) clearInterval(cleanupTimer);

  const forceExit = setTimeout(() => {
    console.error('[shutdown] Graceful shutdown timed out.');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (error) => {
    try {
      await prisma.$disconnect();
      await pool.end();
    } catch (dbError) {
      console.error('[shutdown] Database close failed:', dbError);
      process.exitCode = 1;
    } finally {
      clearTimeout(forceExit);
      if (error) {
        console.error('[shutdown] HTTP server close failed:', error);
        process.exitCode = 1;
      }
      process.exit();
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
