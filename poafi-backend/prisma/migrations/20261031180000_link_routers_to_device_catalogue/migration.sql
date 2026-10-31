-- Link each installed physical router to its optional catalogue model.
-- Existing router records remain valid because the relation is nullable.
ALTER TABLE "Router"
  ADD COLUMN "deviceModelId" TEXT;

CREATE INDEX "Router_deviceModelId_idx" ON "Router"("deviceModelId");

ALTER TABLE "Router"
  ADD CONSTRAINT "Router_deviceModelId_fkey"
  FOREIGN KEY ("deviceModelId") REFERENCES "NetworkDeviceModel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
