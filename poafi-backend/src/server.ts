import express from 'express';
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
import { VoucherCleanupService } from './services/cron/VoucherCleanupService';

const app = express();

const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.56.1:3000'];
const envOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const appOrigins = env.PUBLIC_APP_URL ? [env.PUBLIC_APP_URL.replace(/\/$/, '')] : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins, ...appOrigins]));

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header) and explicitly allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PoaFi API', timestamp: new Date() });
});

app.listen(env.PORT, () => {
  console.log(`🚀 PoaFi API running on http://localhost:${env.PORT}`);
  VoucherCleanupService.startBackgroundJob(60000);
});