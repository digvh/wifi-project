import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { decryptSecret } from '../utils/crypto';
import { MikroTikAdapter } from '../services/network/adapters/MikroTikAdapter';
import { TPLinkOmadaAdapter } from '../services/network/adapters/TPLinkOmadaAdapter';

const router = Router();
router.use(requireAuth);

// Pre-build a 256 KB incompressible random chunk buffer once at module load for fast streaming
const RANDOM_CHUNK = crypto.randomBytes(256 * 1024);

router.get('/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, serverTime: Date.now() });
});

router.get('/download', (req, res) => {
  const requested = parseInt(String(req.query.bytes || '8000000'), 10);
  const totalBytes = Math.min(25_000_000, Math.max(100_000, Number.isFinite(requested) ? requested : 8_000_000));

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(totalBytes));

  let remaining = totalBytes;
  const pushNext = () => {
    while (remaining > 0) {
      const size = Math.min(remaining, RANDOM_CHUNK.length);
      const slice = size === RANDOM_CHUNK.length ? RANDOM_CHUNK : RANDOM_CHUNK.subarray(0, size);
      remaining -= size;
      if (!res.write(slice)) {
        res.once('drain', pushNext);
        return;
      }
    }
    res.end();
  };

  req.on('close', () => {
    remaining = 0;
  });

  pushNext();
});

router.post(
  '/upload',
  express.raw({ type: '*/*', limit: '15mb' }),
  (req, res) => {
    const receivedBytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, receivedBytes, serverTime: Date.now() });
  },
);

router.get('/router/:id/wan', async (req, res) => {
  try {
    const routerDevice = await prisma.router.findUnique({ where: { id: req.params.id } });
    if (!routerDevice) {
      res.status(404).json({ error: 'Router not found' });
      return;
    }
    if (req.user?.role !== 'PLATFORM_ADMIN' && routerDevice.tenantId !== req.user?.tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (routerDevice.vendor !== 'MIKROTIK' && routerDevice.vendor !== 'TPLINK_OMADA') {
      res.status(400).json({ error: 'Live WAN interface probe is supported for MikroTik and TP-Link Omada devices' });
      return;
    }

    const password = decryptSecret(routerDevice.encryptedPassword);
    const stats =
      routerDevice.vendor === 'TPLINK_OMADA'
        ? await new TPLinkOmadaAdapter({
            host: routerDevice.host,
            port: routerDevice.apiPort,
            username: routerDevice.username,
            password,
          }).measureWanStats()
        : await new MikroTikAdapter({
            host: routerDevice.host,
            port: routerDevice.apiPort,
            username: routerDevice.username,
            password,
          }).measureWanStats();

    res.json({
      routerId: routerDevice.id,
      routerName: routerDevice.name,
      vendor: routerDevice.vendor,
      host: routerDevice.host,
      ...stats,
      measuredAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to read router WAN bandwidth' });
  }
});

export default router;
