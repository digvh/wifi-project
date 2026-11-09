CREATE TABLE "RouterProvisioningEnrollment" (
  "id" TEXT NOT NULL,
  "routerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "assignedAddress" TEXT NOT NULL,
  "routerPublicKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCRIPT_ISSUED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RouterProvisioningEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RouterProvisioningEnrollment_tokenHash_key" ON "RouterProvisioningEnrollment"("tokenHash");
CREATE UNIQUE INDEX "RouterProvisioningEnrollment_assignedAddress_key" ON "RouterProvisioningEnrollment"("assignedAddress");
CREATE INDEX "RouterProvisioningEnrollment_routerId_status_idx" ON "RouterProvisioningEnrollment"("routerId", "status");
CREATE INDEX "RouterProvisioningEnrollment_expiresAt_idx" ON "RouterProvisioningEnrollment"("expiresAt");
ALTER TABLE "RouterProvisioningEnrollment" ADD CONSTRAINT "RouterProvisioningEnrollment_routerId_fkey"
FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;
