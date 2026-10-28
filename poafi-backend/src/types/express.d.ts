import { Request } from 'express';

export interface AuthUser {
  userId: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_OWNER' | string;
  tenantId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

