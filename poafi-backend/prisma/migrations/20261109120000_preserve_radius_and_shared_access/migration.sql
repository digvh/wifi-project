-- Preserve PoaFi's existing FreeRADIUS integration while adding the newer device setup workflow.
ALTER TABLE "Package"
  ADD COLUMN IF NOT EXISTS "dataLimitMb" INTEGER,
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'TIME',
  ADD COLUMN IF NOT EXISTS "validityDays" INTEGER;

ALTER TABLE "Voucher"
  ADD COLUMN IF NOT EXISTS "prefix" TEXT,
  ADD COLUMN IF NOT EXISTS "isImported" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Voucher_batchId_idx" ON "Voucher"("batchId");

CREATE TABLE IF NOT EXISTS "radius_nas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "routerId" TEXT,
  "vendor" VARCHAR(80) NOT NULL DEFAULT 'GENERIC',
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

CREATE UNIQUE INDEX IF NOT EXISTS "radius_nas_nasname_key" ON "radius_nas"("nasname");
CREATE INDEX IF NOT EXISTS "radius_nas_tenantId_idx" ON "radius_nas"("tenantId");
CREATE INDEX IF NOT EXISTS "radius_nas_routerId_idx" ON "radius_nas"("routerId");
CREATE UNIQUE INDEX IF NOT EXISTS "radius_sessions_nasId_acctSessionId_key" ON "radius_sessions"("nasId","acctSessionId");
CREATE INDEX IF NOT EXISTS "radius_sessions_voucherId_idx" ON "radius_sessions"("voucherId");
CREATE INDEX IF NOT EXISTS "radius_sessions_username_idx" ON "radius_sessions"("username");
CREATE INDEX IF NOT EXISTS "radius_sessions_status_lastUpdatedAt_idx" ON "radius_sessions"("status","lastUpdatedAt");

DO $$ BEGIN
  ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_routerId_fkey"
    FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "radius_sessions" ADD CONSTRAINT "radius_sessions_nasId_fkey"
    FOREIGN KEY ("nasId") REFERENCES "radius_nas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "radius_sessions" ADD CONSTRAINT "radius_sessions_voucherId_fkey"
    FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
