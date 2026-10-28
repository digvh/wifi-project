// src/utils/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, role: string, tenantId?: string | null) => {
  return jwt.sign({ userId, role, tenantId }, env.JWT_SECRET, { expiresIn: '7d' });
};