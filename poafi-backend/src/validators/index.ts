import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Tenants
export const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
});

export const createTenantLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Routers
export const createRouterSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID').optional(),
  name: z.string().min(1, 'Router name is required').max(100),
  host: z.string().min(1, 'Host is required'),
  apiPort: z.coerce.number().int().min(1).max(65535).default(8728),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  vendor: z.enum(['MIKROTIK', 'TPLINK_OMADA', 'RUIJIE', 'CUDY', 'COMFAST', 'WAVLINK']).default('MIKROTIK'),
});

export const updateRouterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).optional(),
  apiPort: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  vendor: z.enum(['MIKROTIK', 'TPLINK_OMADA', 'RUIJIE', 'CUDY', 'COMFAST', 'WAVLINK']).optional(),
  status: z.string().optional(),
});

// Packages
export const createPackageSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100),
  priceTzs: z.coerce.number().int().min(0, 'Price must be positive'),
  durationMinutes: z.coerce.number().int().min(1, 'Duration must be at least 1 minute'),
  downloadKbps: z.coerce.number().int().min(64).default(3000),
  uploadKbps: z.coerce.number().int().min(64).default(1000),
  routerId: z.string().uuid().optional().nullable(),
});

export const updatePackageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priceTzs: z.coerce.number().int().min(0).optional(),
  durationMinutes: z.coerce.number().int().min(1).optional(),
  downloadKbps: z.coerce.number().int().min(64).optional(),
  uploadKbps: z.coerce.number().int().min(64).optional(),
  routerId: z.string().uuid().optional().nullable(),
});

// Vouchers
export const generateVouchersSchema = z.object({
  packageId: z.string().uuid('Invalid package ID'),
  quantity: z.coerce.number().int().min(1, 'Must generate at least 1').max(500, 'Maximum 500 vouchers per batch'),
});

// Portal
export const redeemVoucherSchema = z.object({
  code: z.string().min(1, 'Voucher code is required').max(20),
  tenantSlug: z.string().min(1, 'Operator identifier is required'),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

