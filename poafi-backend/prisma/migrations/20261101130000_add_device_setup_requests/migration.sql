-- Device setup workflow supporting both operator self-service and Super Admin assistance.
CREATE TABLE "DeviceSetupRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routerId" TEXT,
    "deviceModelId" TEXT,
    "setupMode" TEXT NOT NULL,
    "supportMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "vendor" TEXT NOT NULL,
    "modelName" TEXT,
    "deviceCategory" TEXT NOT NULL,
    "serialNumber" TEXT,
    "siteName" TEXT,
    "siteAddress" TEXT,
    "requestedCapabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "operatorNotes" TEXT,
    "adminNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSetupRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceSetupRequest_tenantId_status_idx"
    ON "DeviceSetupRequest"("tenantId", "status");
CREATE INDEX "DeviceSetupRequest_setupMode_status_idx"
    ON "DeviceSetupRequest"("setupMode", "status");
CREATE INDEX "DeviceSetupRequest_routerId_idx"
    ON "DeviceSetupRequest"("routerId");
CREATE INDEX "DeviceSetupRequest_deviceModelId_idx"
    ON "DeviceSetupRequest"("deviceModelId");

ALTER TABLE "DeviceSetupRequest"
    ADD CONSTRAINT "DeviceSetupRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceSetupRequest"
    ADD CONSTRAINT "DeviceSetupRequest_routerId_fkey"
    FOREIGN KEY ("routerId") REFERENCES "Router"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceSetupRequest"
    ADD CONSTRAINT "DeviceSetupRequest_deviceModelId_fkey"
    FOREIGN KEY ("deviceModelId") REFERENCES "NetworkDeviceModel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
