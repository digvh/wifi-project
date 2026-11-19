// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { SESSION_COOKIE_NAME, passwordVersion } from '../utils/auth';

// Extend Express Request type to include the user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role: string;
    tenantId?: string | null;
    sessionIssuedAt?: number;
  };
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const cookieToken = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No active session' });
    return;
  }

  // CSRF defense-in-depth for cookie-authenticated state-changing requests
  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (cookieToken && !bearerToken && isStateChanging && req.header('x-requested-with') !== 'PoaFi-Web') {
    res.status(403).json({ error: 'Forbidden: Missing CSRF request header' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      role: string;
      tenantId?: string;
      pv?: string;
      iat?: number;
    };

    // Verify user & tenant still exist and remain active so deleted/suspended accounts lose access immediately.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        tenant: { select: { isActive: true } },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Account no longer exists' });
      return;
    }

    if (decoded.pv && decoded.pv !== passwordVersion(user.passwordHash)) {
      res.status(401).json({ error: 'Unauthorized: Password changed, please log in again' });
      return;
    }

    if (user.role !== 'PLATFORM_ADMIN' && user.tenant && !user.tenant.isActive) {
      res.status(403).json({ error: 'Account suspended. Contact PoaFi support.' });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionIssuedAt: decoded.iat ? decoded.iat * 1000 : undefined,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
};

export const requirePlatformAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'PLATFORM_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Platform Admin access required' });
    return;
  }
  next();
};
