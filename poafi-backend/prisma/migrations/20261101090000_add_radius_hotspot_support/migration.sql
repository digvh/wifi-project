-- PoaFi RADIUS NAS clients and accounting sessions.
-- The NAS table follows the FreeRADIUS SQL client schema and adds tenant ownership.
CREATE TABLE "nas" (
  "id" SERIAL NOT NULL,
  "nasname" VARCHAR(128) NOT NULL,
  "shortname" VARCHAR(32) NOT NULL,
  "type" VARCHAR(30) NOT NULL DEFAULT 'other',
  "secret" VARCHAR(60) NOT NULL,
  "server" VARCHAR(64),
  "community" VARCHAR(50),
  "description" VARCHAR(200),
  "tenant_id" TEXT NOT NULL,
  "router_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nas_nasname_key" ON "nas"("nasname");
CREATE INDEX "nas_tenant_id_idx" ON "nas"("tenant_id");
CREATE INDEX "nas_router_id_idx" ON "nas"("router_id");

ALTER TABLE "nas"
  ADD CONSTRAINT "nas_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nas"
  ADD CONSTRAINT "nas_router_id_fkey"
  FOREIGN KEY ("router_id") REFERENCES "Router"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "radius_sessions" (
  "id" TEXT NOT NULL,
  "nasId" INTEGER NOT NULL,
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
  FOREIGN KEY ("nasId") REFERENCES "nas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "radius_sessions"
  ADD CONSTRAINT "radius_sessions_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
