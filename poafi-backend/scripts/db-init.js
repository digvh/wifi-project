/**
 * Lightweight Shared-Hosting Database Initializer & Seeder (Zero Prisma CLI / Zero WASM).
 *
 * Why this exists:
 * On cPanel / CloudLinux shared hosting, running `prisma migrate` or `prisma db push`
 * often crashes with `WebAssembly.instantiate(): Out of memory` due to LVE memory limits.
 * This pure Node.js script uses `pg` + `bcryptjs` directly (~30MB RAM) to:
 *   1. Apply prisma/poafi-schema.sql (all tables, indexes, constraints).
 *   2. Seed the initial Platform Admin account and default operator + packages.
 *
 * Usage on shared hosting:
 *   npm run db:init
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const needsSsl =
    process.env.DB_SSL === 'true' ||
    /sslmode=(require|verify-full|verify-ca)/i.test(connectionString);

  const pool = new Pool({
    connectionString,
    max: 2,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    console.log('📦 Applying PoaFi PostgreSQL schema (prisma/poafi-schema.sql)...');
    const sqlPath = path.join(__dirname, '../prisma/poafi-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Database tables and indexes verified.');

    // 1. Seed Platform Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@poafi.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    const existingAdmin = await pool.query('SELECT id FROM "User" WHERE email = $1', [adminEmail]);

    if (existingAdmin.rowCount === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        'INSERT INTO "User" ("id", "email", "passwordHash", "role") VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), adminEmail, passwordHash, 'PLATFORM_ADMIN'],
      );
      console.log(`✅ Platform Admin created: ${adminEmail}`);
    } else {
      console.log(`ℹ️ Platform Admin (${adminEmail}) already exists.`);
    }

    // 2. Seed Default Operator (Tanga) if not present
    let tenantId;
    const existingTenant = await pool.query('SELECT id FROM "Tenant" WHERE slug = $1', ['tanga']);
    if (existingTenant.rowCount === 0) {
      tenantId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO "Tenant" ("id", "name", "slug", "isActive") VALUES ($1, $2, $3, $4)',
        [tenantId, 'Tanga High-Speed WiFi', 'tanga', true],
      );
      console.log('✅ Default operator created: Tanga High-Speed WiFi (slug: tanga)');
    } else {
      tenantId = existingTenant.rows[0].id;
    }

    const opEmail = 'tanga@poafi.com';
    const existingOp = await pool.query('SELECT id FROM "User" WHERE email = $1', [opEmail]);
    if (existingOp.rowCount === 0) {
      const opHash = await bcrypt.hash('Operator123!', 10);
      await pool.query(
        'INSERT INTO "User" ("id", "tenantId", "email", "passwordHash", "role") VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), tenantId, opEmail, opHash, 'TENANT_OWNER'],
      );
      console.log(`✅ Default operator login created: ${opEmail}`);
    }

    // 3. Seed Starter Packages
    const defaultPackages = [
      { name: '30 Mins Pass', priceTzs: 500, durationMinutes: 30, downloadKbps: 3000, uploadKbps: 1000 },
      { name: '2 Hours Pass', priceTzs: 1000, durationMinutes: 120, downloadKbps: 3000, uploadKbps: 1000 },
      { name: '24 Hours Pass', priceTzs: 2500, durationMinutes: 1440, downloadKbps: 5000, uploadKbps: 2000 },
      { name: '7 Days Unlimited', priceTzs: 10000, durationMinutes: 10080, downloadKbps: 5000, uploadKbps: 2000 },
    ];

    for (const pkg of defaultPackages) {
      const existingPkg = await pool.query(
        'SELECT id FROM "Package" WHERE "tenantId" = $1 AND "name" = $2',
        [tenantId, pkg.name],
      );
      if (existingPkg.rowCount === 0) {
        await pool.query(
          'INSERT INTO "Package" ("id", "tenantId", "name", "priceTzs", "durationMinutes", "downloadKbps", "uploadKbps") VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [crypto.randomUUID(), tenantId, pkg.name, pkg.priceTzs, pkg.durationMinutes, pkg.downloadKbps, pkg.uploadKbps],
        );
      }
    }

    console.log('🎉 Shared hosting database initialization complete!');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Database initialization failed:', err.message || err);
  process.exit(1);
});
