-- ============================================================================
-- PoaFi Complete PostgreSQL Schema (Shared Hosting / cPanel phpPgAdmin Ready)
-- Safe to run multiple times (idempotent CREATE TABLE / INDEX IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "paymentMode" TEXT NOT NULL DEFAULT 'MIXED',
  "subscriptionPlan" TEXT NOT NULL DEFAULT 'POAFI_PAY_COMMISSION',
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE',
  "subscriptionExpiresAt" TIMESTAMP(3),
  "subscriptionMaxSites" INTEGER NOT NULL DEFAULT 1,
  "portalLogoUrl" TEXT,
  "portalColor" TEXT,
  "portalTagline" TEXT,
  "supportPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT NOT NULL DEFAULT 'POAFI_PAY_COMMISSION';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionMaxSites" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'TENANT_OWNER'
);

CREATE TABLE IF NOT EXISTS "Site" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Site_tenantId_idx" ON "Site"("tenantId");

CREATE TABLE IF NOT EXISTS "NetworkDeviceModel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subcategory" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'INDOOR',
  "coverageMeters" INTEGER,
  "coverageNote" TEXT,
  "frequencyBands" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "wifiStandard" TEXT,
  "maxClients" INTEGER,
  "maxSpeedMbps" INTEGER,
  "antenna" TEXT,
  "poe" TEXT,
  "ipRating" TEXT,
  "managementPlatform" TEXT,
  "hotspotSupport" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkDeviceModel_brand_model_key" ON "NetworkDeviceModel"("brand", "model");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_category_idx" ON "NetworkDeviceModel"("category");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_brand_idx" ON "NetworkDeviceModel"("brand");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_coverageMeters_idx" ON "NetworkDeviceModel"("coverageMeters");

CREATE TABLE IF NOT EXISTS "Router" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "siteId" TEXT REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "vendor" TEXT NOT NULL DEFAULT 'MIKROTIK',
  "host" TEXT NOT NULL,
  "apiPort" INTEGER NOT NULL DEFAULT 8728,
  "username" TEXT NOT NULL,
  "encryptedPassword" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "deviceModelId" TEXT REFERENCES "NetworkDeviceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "siteName" TEXT,
  "installationAddress" TEXT,
  "connectionMode" TEXT NOT NULL DEFAULT 'DIRECT',
  "setupStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "installationNotes" TEXT,
  "wgPrivateKey" TEXT,
  "wgPublicKey" TEXT,
  "wgIp" TEXT,
  "enrollmentToken" TEXT UNIQUE,
  "enrollmentExpiresAt" TIMESTAMP(3),
  "discoveredModel" TEXT,
  "discoveredSerial" TEXT,
  "discoveredIdentity" TEXT,
  "discoveredVersion" TEXT,
  "discoveredAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Router_tenantId_idx" ON "Router"("tenantId");
CREATE INDEX IF NOT EXISTS "Router_deviceModelId_idx" ON "Router"("deviceModelId");
CREATE INDEX IF NOT EXISTS "Router_siteId_idx" ON "Router"("siteId");

CREATE TABLE IF NOT EXISTS "DeviceSetupRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestType" TEXT NOT NULL DEFAULT 'SELF',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "deviceName" TEXT,
  "deviceVendor" TEXT,
  "deviceModelId" TEXT REFERENCES "NetworkDeviceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "routerId" TEXT REFERENCES "Router"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "macAddress" TEXT,
  "serialNumber" TEXT,
  "notes" TEXT,
  "adminNotes" TEXT,
  "assignedToId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeviceSetupRequest_tenantId_idx" ON "DeviceSetupRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "DeviceSetupRequest_status_idx" ON "DeviceSetupRequest"("status");

CREATE TABLE IF NOT EXISTS "Package" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "routerId" TEXT REFERENCES "Router"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "priceTzs" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "downloadKbps" INTEGER NOT NULL DEFAULT 3000,
  "uploadKbps" INTEGER NOT NULL DEFAULT 1000,
  "dataLimitMb" INTEGER,
  "type" TEXT NOT NULL DEFAULT 'TIME',
  "validityDays" INTEGER,
  "isOffer" BOOLEAN NOT NULL DEFAULT false,
  "offerType" TEXT,
  "offerActive" BOOLEAN NOT NULL DEFAULT true,
  "originalPriceTzs" INTEGER,
  "offerEndsAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Package_tenantId_idx" ON "Package"("tenantId");

CREATE TABLE IF NOT EXISTS "OfferClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "packageId" TEXT NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "deviceKey" TEXT NOT NULL,
  "ipAddress" TEXT,
  "phoneNumber" TEXT,
  "voucherCode" TEXT,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfferClaim_tenantId_packageId_deviceKey_key" ON "OfferClaim"("tenantId", "packageId", "deviceKey");
CREATE INDEX IF NOT EXISTS "OfferClaim_tenantId_ipAddress_idx" ON "OfferClaim"("tenantId", "ipAddress");
CREATE INDEX IF NOT EXISTS "OfferClaim_tenantId_phoneNumber_idx" ON "OfferClaim"("tenantId", "phoneNumber");

CREATE TABLE IF NOT EXISTS "Voucher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "packageId" TEXT NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "codeHash" TEXT NOT NULL UNIQUE,
  "encryptedCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNUSED',
  "activatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "usedByIp" TEXT,
  "prefix" TEXT,
  "isImported" BOOLEAN NOT NULL DEFAULT false,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Voucher_tenantId_idx" ON "Voucher"("tenantId");
CREATE INDEX IF NOT EXISTS "Voucher_tenantId_status_idx" ON "Voucher"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Voucher_batchId_idx" ON "Voucher"("batchId");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "packageId" TEXT NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "voucherId" TEXT UNIQUE REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "provider" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "reference" TEXT NOT NULL UNIQUE,
  "externalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "accessTokenHash" TEXT UNIQUE,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_reference_idx" ON "Payment"("reference");
CREATE INDEX IF NOT EXISTS "Payment_phoneNumber_idx" ON "Payment"("phoneNumber");

CREATE TABLE IF NOT EXISTS "PayoutMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT,
  "bankBic" TEXT,
  "transferType" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "otpCode" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PayoutMethod_tenantId_idx" ON "PayoutMethod"("tenantId");

CREATE TABLE IF NOT EXISTS "Withdrawal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payoutMethodId" TEXT NOT NULL REFERENCES "PayoutMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "Withdrawal_tenantId_idx" ON "Withdrawal"("tenantId");

CREATE TABLE IF NOT EXISTS "radius_nas" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "routerId" TEXT REFERENCES "Router"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "vendor" TEXT NOT NULL DEFAULT 'GENERIC',
  "model" TEXT,
  "name" TEXT NOT NULL,
  "nasname" VARCHAR(128) NOT NULL UNIQUE,
  "shortname" VARCHAR(32) NOT NULL,
  "type" VARCHAR(30) NOT NULL DEFAULT 'other',
  "encryptedSecret" TEXT NOT NULL,
  "description" VARCHAR(200),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "radius_nas_tenantId_idx" ON "radius_nas"("tenantId");
CREATE INDEX IF NOT EXISTS "radius_nas_routerId_idx" ON "radius_nas"("routerId");

CREATE TABLE IF NOT EXISTS "radius_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nasId" TEXT NOT NULL REFERENCES "radius_nas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "voucherId" TEXT REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "acctSessionId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'START',
  "framedIpAddress" TEXT,
  "callingStationId" TEXT,
  "calledStationId" TEXT,
  "inputOctets" BIGINT NOT NULL DEFAULT 0,
  "outputOctets" BIGINT NOT NULL DEFAULT 0,
  "sessionTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "radius_sessions_nasId_acctSessionId_key" ON "radius_sessions"("nasId", "acctSessionId");
CREATE INDEX IF NOT EXISTS "radius_sessions_voucherId_idx" ON "radius_sessions"("voucherId");
CREATE INDEX IF NOT EXISTS "radius_sessions_username_idx" ON "radius_sessions"("username");
CREATE INDEX IF NOT EXISTS "radius_sessions_status_lastUpdatedAt_idx" ON "radius_sessions"("status", "lastUpdatedAt");

CREATE TABLE IF NOT EXISTS "PaymentConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL UNIQUE REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'AZAMPAY',
  "appName" TEXT,
  "clientId" TEXT,
  "encryptedApiKey" TEXT,
  "encryptedSecret" TEXT,
  "webhookSecret" TEXT,
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PaymentGatewaySetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
  "encryptedCredentials" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "lastTestMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGatewaySetting_tenantId_provider_key" ON "PaymentGatewaySetting"("tenantId", "provider");
CREATE INDEX IF NOT EXISTS "PaymentGatewaySetting_tenantId_idx" ON "PaymentGatewaySetting"("tenantId");

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "planId" TEXT NOT NULL,
  "months" INTEGER NOT NULL DEFAULT 1,
  "amountTzs" INTEGER NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'MPESA',
  "phoneNumber" TEXT NOT NULL,
  "reference" TEXT NOT NULL UNIQUE,
  "externalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

CREATE TABLE IF NOT EXISTS "OperatorApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "passwordHash" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT
);
