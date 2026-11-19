import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import routerRoutes from './routes/routers';
import packageRoutes from './routes/packages';
import voucherRoutes from './routes/vouchers';
import portalRoutes from './routes/portal';
import paymentRoutes from './routes/payments';
import statsRoutes from './routes/stats';
import applicationRoutes from './routes/applications';
import deviceCatalogRoutes from './routes/deviceCatalog';
import radiusRoutes from './routes/radius';
import deviceSetupRoutes from './routes/deviceSetup';
import siteRoutes from './routes/sites';
import payoutRoutes from './routes/payouts';
import enrollmentRoutes from './routes/enrollment';
import speedtestRoutes from './routes/speedtest';
import cronRoutes from './routes/cron';
import { VoucherCleanupService } from './services/cron/VoucherCleanupService';

const app = express();

// Behind cPanel/Passenger, Apache, Nginx or Cloudflare, trust the proxy hop(s)
// so rate limiting and logging see the real client IP.
if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
}

const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.56.1:3000',
  `http://localhost:${env.PORT}`,
  `http://127.0.0.1:${env.PORT}`,
];
const envOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
const appOrigins = env.PUBLIC_APP_URL ? [env.PUBLIC_APP_URL.replace(/\/$/, '')] : [];
const apiOrigins = env.PUBLIC_API_URL ? [env.PUBLIC_API_URL.replace(/\/$/, '')] : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins, ...appOrigins, ...apiOrigins]));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header) and explicitly allowed origins
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/routers', routerRoutes);
app.use('/api/enroll', enrollmentRoutes);
app.use('/api/radius', radiusRoutes);
app.use('/api/device-catalog', deviceCatalogRoutes);
app.use('/api/device-setup', deviceSetupRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/speedtest', speedtestRoutes);
app.use('/api/internal/cron', cronRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PoaFi API',
    mode: env.BACKGROUND_JOBS ? 'persistent' : 'shared-hosting-cron',
    timestamp: new Date(),
  });
});

// Optional Single-App Shared Hosting Mode:
// If the exported static frontend exists in ./public or ../poafi-frontend/out,
// serve it directly from this Express process so one cPanel Node.js App can host both UI + API.
const candidateFrontendDirs = [
  env.STATIC_FRONTEND_DIR ? path.resolve(env.STATIC_FRONTEND_DIR) : '',
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../poafi-frontend/out'),
].filter(Boolean);

const staticFrontendDir = candidateFrontendDirs.find((dir) => {
  try {
    return fs.existsSync(path.join(dir, 'index.html'));
  } catch {
    return false;
  }
});

if (staticFrontendDir) {
  app.use(
    express.static(staticFrontendDir, {
      extensions: ['html'],
      index: 'index.html',
    }),
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
    const htmlCandidate = cleanPath ? path.join(staticFrontendDir, `${cleanPath}.html`) : '';
    const indexCandidate = cleanPath ? path.join(staticFrontendDir, cleanPath, 'index.html') : '';

    if (htmlCandidate && fs.existsSync(htmlCandidate)) {
      res.sendFile(htmlCandidate);
      return;
    }
    if (indexCandidate && fs.existsSync(indexCandidate)) {
      res.sendFile(indexCandidate);
      return;
    }
    res.sendFile(path.join(staticFrontendDir, 'index.html'));
  });
}

app.listen(env.PORT, () => {
  console.log(`🚀 PoaFi API running on http://localhost:${env.PORT}`);
  if (staticFrontendDir) {
    console.log(`🌐 Serving static frontend from ${staticFrontendDir}`);
  }
  if (env.BACKGROUND_JOBS) {
    VoucherCleanupService.startBackgroundJob(60000);
  } else {
    console.log('⏱️ Shared hosting mode (BACKGROUND_JOBS=false): use cPanel Cron -> /api/internal/cron/run');
    VoucherCleanupService.recoverOrphanedVouchers().catch((err) =>
      console.error('[VoucherCleanup] Boot recovery error:', err),
    );
  }
});

export default app;