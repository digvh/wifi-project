-- Phase A migration: Add RADIUS hotspot support + ensure all schema
-- additions from PR #4 (device catalogue) and Phase 1 bundles are present.
-- Idempotent: safe to run on databases that already have some of these
-- tables/columns. Does NOT re-insert catalogue seed data.

-- 1. NetworkDeviceModel table (may already exist from earlier work)
CREATE TABLE IF NOT EXISTS "NetworkDeviceModel" (
  "id" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subcategory" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'INDOOR',
  "coverageMeters" INTEGER,
  "coverageNote" TEXT,
  "frequencyBands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NetworkDeviceModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NetworkDeviceModel_brand_model_key" ON "NetworkDeviceModel"("brand","model");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_category_idx" ON "NetworkDeviceModel"("category");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_brand_idx" ON "NetworkDeviceModel"("brand");
CREATE INDEX IF NOT EXISTS "NetworkDeviceModel_coverageMeters_idx" ON "NetworkDeviceModel"("coverageMeters");

-- 2. Router device catalogue + install columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='deviceModelId') THEN
    ALTER TABLE "Router" ADD COLUMN "deviceModelId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='siteName') THEN
    ALTER TABLE "Router" ADD COLUMN "siteName" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='installationAddress') THEN
    ALTER TABLE "Router" ADD COLUMN "installationAddress" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='connectionMode') THEN
    ALTER TABLE "Router" ADD COLUMN "connectionMode" TEXT NOT NULL DEFAULT 'DIRECT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='setupStatus') THEN
    ALTER TABLE "Router" ADD COLUMN "setupStatus" TEXT NOT NULL DEFAULT 'PENDING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Router' AND column_name='installationNotes') THEN
    ALTER TABLE "Router" ADD COLUMN "installationNotes" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Router_deviceModelId_idx" ON "Router"("deviceModelId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Router_deviceModelId_fkey') THEN
    ALTER TABLE "Router" ADD CONSTRAINT "Router_deviceModelId_fkey"
      FOREIGN KEY ("deviceModelId") REFERENCES "NetworkDeviceModel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Package bundle fields (Phase 1)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Package' AND column_name='dataLimitMb') THEN
    ALTER TABLE "Package" ADD COLUMN "dataLimitMb" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Package' AND column_name='type') THEN
    ALTER TABLE "Package" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'TIME';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Package' AND column_name='validityDays') THEN
    ALTER TABLE "Package" ADD COLUMN "validityDays" INTEGER;
  END IF;
END $$;

-- 4. Voucher tracking fields (Phase 1)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Voucher' AND column_name='prefix') THEN
    ALTER TABLE "Voucher" ADD COLUMN "prefix" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Voucher' AND column_name='isImported') THEN
    ALTER TABLE "Voucher" ADD COLUMN "isImported" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Voucher' AND column_name='issuedAt') THEN
    ALTER TABLE "Voucher" ADD COLUMN "issuedAt" TIMESTAMP(3);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Voucher_batchId_idx" ON "Voucher"("batchId");

-- 5. RADIUS NAS client registry
CREATE TABLE IF NOT EXISTS "radius_nas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "routerId" TEXT,
  "vendor" TEXT NOT NULL DEFAULT 'GENERIC',
  "model" TEXT,
  "name" TEXT NOT NULL,
  "nasname" VARCHAR(128) NOT NULL,
  "shortname" VARCHAR(32) NOT NULL,
  "type" VARCHAR(30) NOT NULL DEFAULT 'other',
  "encryptedSecret" TEXT NOT NULL,
  "description" VARCHAR(200),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "radius_nas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "radius_nas_nasname_key" ON "radius_nas"("nasname");
CREATE INDEX IF NOT EXISTS "radius_nas_tenantId_idx" ON "radius_nas"("tenantId");
CREATE INDEX IF NOT EXISTS "radius_nas_routerId_idx" ON "radius_nas"("routerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='radius_nas_tenantId_fkey') THEN
    ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='radius_nas_routerId_fkey') THEN
    ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_routerId_fkey"
      FOREIGN KEY ("routerId") REFERENCES "Router"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. RADIUS accounting sessions
CREATE TABLE IF NOT EXISTS "radius_sessions" (
  "id" TEXT NOT NULL,
  "nasId" TEXT NOT NULL,
  "voucherId" TEXT,
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
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
  "stoppedAt" TIMESTAMP(3),
  CONSTRAINT "radius_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "radius_sessions_nasId_acctSessionId_key" ON "radius_sessions"("nasId", "acctSessionId");
CREATE INDEX IF NOT EXISTS "radius_sessions_voucherId_idx" ON "radius_sessions"("voucherId");
CREATE INDEX IF NOT EXISTS "radius_sessions_username_idx" ON "radius_sessions"("username");
CREATE INDEX IF NOT EXISTS "radius_sessions_status_lastUpdatedAt_idx" ON "radius_sessions"("status", "lastUpdatedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='radius_sessions_nasId_fkey') THEN
    ALTER TABLE "radius_sessions" ADD CONSTRAINT "radius_sessions_nasId_fkey"
      FOREIGN KEY ("nasId") REFERENCES "radius_nas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='radius_sessions_voucherId_fkey') THEN
    ALTER TABLE "radius_sessions" ADD CONSTRAINT "radius_sessions_voucherId_fkey"
      FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;