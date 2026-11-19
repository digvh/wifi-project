import { Router } from 'express';
import { prisma } from '../config/database';
import {
  SESSION_COOKIE_NAME,
  comparePassword,
  generateToken,
  passwordVersion,
  sessionCookieOptions,
} from '../utils/auth';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema } from '../validators';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { isActive: true } } },
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.role !== 'PLATFORM_ADMIN' && user.tenant && !user.tenant.isActive) {
      res.status(403).json({ error: 'Account suspended. Contact PoaFi support.' });
      return;
    }

    const token = generateToken(
      user.id,
      user.role,
      user.tenantId,
      passwordVersion(user.passwordHash),
    );

    // Issue HttpOnly browser session cookie (deleted automatically when browser closes)
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
      tenantId: req.user!.tenantId,
    },
    sessionIssuedAt: req.user!.sessionIssuedAt,
  });
});

export default router;
