-- RADIUS client registry and accounting sessions.
-- NAS shared secrets are encrypted by PoaFi and returned only to FreeRADIUS
-- during dynamic client discovery. They are not stored in a plaintext clients file.
CREATE TABLE "radius_nas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "routerId" TEXT,
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

CREATE UNIQUE INDEX "radius_nas_nasname_key" ON "radius_nas"("nasname");
CREATE INDEX "radius_nas_tenantId_idx" ON "radius_nas"("tenantId");
CREATE INDEX "radius_nas_routerId_idx" ON "radius_nas"("routerId");

ALTER TABLE "radius_nas"
  ADD CONSTRAINT "radius_nas_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "radius_nas"
  ADD CONSTRAINT "radius_nas_routerId_fkey"
  FOREIGN KEY ("routerId") REFERENCES "Router"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "radius_sessions" (
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

CREATE UNIQUE INDEX "radius_sessions_nasId_acctSessionId_key"
  ON "radius_sessions"("nasId", "acctSessionId");
CREATE INDEX "radius_sessions_voucherId_idx" ON "radius_sessions"("voucherId");
CREATE INDEX "radius_sessions_username_idx" ON "radius_sessions"("username");
CREATE INDEX "radius_sessions_status_lastUpdatedAt_idx"
  ON "radius_sessions"("status", "lastUpdatedAt");

ALTER TABLE "radius_sessions"
  ADD CONSTRAINT "radius_sessions_nasId_fkey"
  FOREIGN KEY ("nasId") REFERENCES "radius_nas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "radius_sessions"
  ADD CONSTRAINT "radius_sessions_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
