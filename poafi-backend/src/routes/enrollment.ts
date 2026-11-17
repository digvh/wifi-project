import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../config/database';

/**
 * PUBLIC endpoint called by a router (via RouterOS /tool fetch) during zero-touch enrollment.
 * Protected only by the one-time, 30-minute enrollment token, which is consumed on first use.
 */
const router = Router();

const enrollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enrollment attempts' },
});

// Keep only printable, harmless characters and cap length (values are shown in the UI).
const clean = (max: number) =>
  z.string().max(200).transform((v) => v.replace(/[^\w .:@\-\/()]/g, '').trim().slice(0, max)).default('');

const reportSchema = z.object({
  model: clean(80),
  serial: clean(80),
  identity: clean(80),
  version: clean(40),
});

router.post('/', enrollLimiter, async (req, res) => {
  try {
    const token = String(req.header('x-enrollment-token') || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(token)) {
      res.status(401).json({ error: 'Invalid or expired enrollment token' });
      return;
    }

    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid device report' });
      return;
    }

    const found: any = await prisma.router.findUnique({ where: { enrollmentToken: token } });
    if (!found || !found.enrollmentExpiresAt || new Date(found.enrollmentExpiresAt) < new Date()) {
      res.status(401).json({ error: 'Invalid or expired enrollment token' });
      return;
    }

    const { model, serial, identity, version } = parsed.data;

    await prisma.router.update({
      where: { id: found.id },
      data: {
        discoveredModel: model || null,
        discoveredSerial: serial || null,
        discoveredIdentity: identity || null,
        discoveredVersion: version || null,
        discoveredAt: new Date(),
        setupStatus: 'DISCOVERED',
        enrollmentToken: null, // single use
        enrollmentExpiresAt: null,
      } as any,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Enrollment phone-home error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

export default router;
