import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Create Platform Admin
  const email = 'admin@poafi.com';
  const password = 'AdminPassword123!';
  
  let admin = await prisma.user.findUnique({ where: { email } });
  
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'PLATFORM_ADMIN',
      },
    });
    console.log(`✅ Admin created! Email: ${email} | Password: ${password}`);
  } else {
    console.log('Admin already exists.');
  }

  // 2. Create Default Operator (Tenant): Tanga WiFi
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'tanga' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Tanga High-Speed WiFi',
        slug: 'tanga',
        isActive: true,
      },
    });
    console.log(`✅ Default operator created: Tanga High-Speed WiFi (slug: tanga)`);
  } else {
    console.log('Operator "tanga" already exists.');
  }

  // 3. Create Default Operator Login
  const operatorEmail = 'tanga@poafi.com';
  const operatorPass = 'Operator123!';
  const existingOperatorUser = await prisma.user.findUnique({ where: { email: operatorEmail } });
  if (!existingOperatorUser) {
    const opHash = await bcrypt.hash(operatorPass, 10);
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: operatorEmail,
        passwordHash: opHash,
        role: 'TENANT_OWNER',
      },
    });
    console.log(`✅ Operator login created: ${operatorEmail} | Password: ${operatorPass}`);
  }

  // 4. Create Standard Wi-Fi Packages
  const defaultPackages = [
    { name: '30 Mins Pass', priceTzs: 500, durationMinutes: 30, downloadKbps: 3000, uploadKbps: 1000 },
    { name: '2 Hours Pass', priceTzs: 1000, durationMinutes: 120, downloadKbps: 3000, uploadKbps: 1000 },
    { name: '24 Hours Pass', priceTzs: 2500, durationMinutes: 1440, downloadKbps: 5000, uploadKbps: 2000 },
    { name: '7 Days Unlimited', priceTzs: 10000, durationMinutes: 10080, downloadKbps: 5000, uploadKbps: 2000 },
  ];

  for (const pkg of defaultPackages) {
    const existing = await prisma.package.findFirst({
      where: { tenantId: tenant.id, name: pkg.name },
    });
    if (!existing) {
      await prisma.package.create({
        data: {
          tenantId: tenant.id,
          ...pkg,
        },
      });
      console.log(`✅ Package created: ${pkg.name} (TZS ${pkg.priceTzs})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
