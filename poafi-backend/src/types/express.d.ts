import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email?: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_OWNER' | string;
  tenantId?: string | null;
  sessionIssuedAt?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

