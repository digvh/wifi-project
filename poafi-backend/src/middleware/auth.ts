// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';

// Extend Express Request type to include the user
export interface AuthRequest extends Request {
  user?: { userId: string; role: string; tenantId?: string | null };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string; tenantId?: string };

    // Verify user & tenant still exist and remain active so deleted/suspended accounts lose access immediately.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        tenantId: true,
        tenant: { select: { isActive: true } },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Account no longer exists' });
      return;
    }

    if (user.role !== 'PLATFORM_ADMIN' && user.tenant && !user.tenant.isActive) {
      res.status(403).json({ error: 'Account suspended. Contact PoaFi support.' });
      return;
    }

    req.user = {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requirePlatformAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'PLATFORM_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Platform Admin access required' });
    return;
  }
  next();
};
