-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "usedByIp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Voucher_codeHash_key" ON "Voucher"("codeHash");
CREATE INDEX IF NOT EXISTS "Router_tenantId_idx" ON "Router"("tenantId");
CREATE INDEX IF NOT EXISTS "Package_tenantId_idx" ON "Package"("tenantId");
CREATE INDEX IF NOT EXISTS "Voucher_tenantId_idx" ON "Voucher"("tenantId");
CREATE INDEX IF NOT EXISTS "Voucher_tenantId_status_idx" ON "Voucher"("tenantId", "status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "voucherId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "provider" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AZAMPAY',
    "appName" TEXT,
    "clientId" TEXT,
    "encryptedApiKey" TEXT,
    "encryptedSecret" TEXT,
    "webhookSecret" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_reference_key" ON "Payment"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_voucherId_key" ON "Payment"("voucherId");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_reference_idx" ON "Payment"("reference");
CREATE INDEX IF NOT EXISTS "Payment_phoneNumber_idx" ON "Payment"("phoneNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentConfig_tenantId_key" ON "PaymentConfig"("tenantId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_tenantId_fkey') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_packageId_fkey') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_voucherId_fkey') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentConfig_tenantId_fkey') THEN
        ALTER TABLE "PaymentConfig" ADD CONSTRAINT "PaymentConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

