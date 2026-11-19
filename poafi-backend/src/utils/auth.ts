// src/utils/auth.ts
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { CookieOptions } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'poafi_session';

export function sessionCookieOptions(): CookieOptions {
  // Deliberately omit maxAge and expires so browsers treat this as a session-only
  // cookie and discard it automatically when the browser is closed.
  const sameSite = env.COOKIE_SAME_SITE;
  const secure = sameSite === 'none' ? true : env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function passwordVersion(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 12);
}

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (
  userId: string,
  role: string,
  tenantId?: string | null,
  pv?: string,
) => {
  return jwt.sign(
    { userId, role, tenantId, ...(pv ? { pv } : {}) },
    env.JWT_SECRET,
    { expiresIn: '12h' },
  );
};
