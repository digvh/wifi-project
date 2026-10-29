CREATE TABLE "NetworkDeviceModel" (
 "id" TEXT NOT NULL, "brand" TEXT NOT NULL, "model" TEXT NOT NULL,
 "category" TEXT NOT NULL, "subcategory" TEXT, "environment" TEXT NOT NULL DEFAULT 'INDOOR',
 "coverageMeters" INTEGER, "coverageNote" TEXT, "frequencyBands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "wifiStandard" TEXT, "maxClients" INTEGER, "maxSpeedMbps" INTEGER, "antenna" TEXT, "poe" TEXT,
 "ipRating" TEXT, "managementPlatform" TEXT, "hotspotSupport" BOOLEAN NOT NULL DEFAULT false,
 "notes" TEXT, "sourceUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "NetworkDeviceModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkDeviceModel_brand_model_key" ON "NetworkDeviceModel"("brand","model");
CREATE INDEX "NetworkDeviceModel_category_idx" ON "NetworkDeviceModel"("category");
CREATE INDEX "NetworkDeviceModel_brand_idx" ON "NetworkDeviceModel"("brand");
CREATE INDEX "NetworkDeviceModel_coverageMeters_idx" ON "NetworkDeviceModel"("coverageMeters");
INSERT INTO "NetworkDeviceModel"
("id","brand","model","category","subcategory","environment","coverageMeters","coverageNote","frequencyBands","wifiStandard","poe","ipRating","managementPlatform","hotspotSupport","notes","sourceUrl","updatedAt")
VALUES
('eap110-outdoor','TP-Link','EAP110-Outdoor','ACCESS_POINT','Outdoor','OUTDOOR',200,'Manufacturer-stated maximum outdoor range; actual range varies by environment and client device.',ARRAY['2.4 GHz'],'Wi-Fi 4','Passive PoE','IP65','Standalone / Omada (model and firmware dependent)',false,'Coverage is a manufacturer maximum, not a guaranteed service radius.','https://www.tp-link.com/en/business-networking/omada-sdn-access-point/eap110-outdoor/',CURRENT_TIMESTAMP),
('eap225-outdoor','TP-Link','EAP225-Outdoor','ACCESS_POINT','Outdoor','OUTDOOR',300,'Up to 300 m on 5 GHz; up to 200 m on 2.4 GHz in manufacturer guidance.',ARRAY['2.4 GHz','5 GHz'],'Wi-Fi 5','802.3af/at PoE','IP65','Omada SDN',false,'Maximum range depends on environment, interference, mounting and client capability.','https://www.tp-link.com/en/business-networking/omada-sdn-access-point/eap225-outdoor/',CURRENT_TIMESTAMP),
('eap610-outdoor','TP-Link','EAP610-Outdoor','ACCESS_POINT','Outdoor','OUTDOOR',300,'Up to 300 m on 5 GHz; up to 200 m on 2.4 GHz in manufacturer guidance.',ARRAY['2.4 GHz','5 GHz'],'Wi-Fi 6','802.3at PoE','IP68','Omada SDN',false,'Maximum range depends on environment, interference, mounting and client capability.','https://www.tp-link.com/en/business-networking/omada-sdn-access-point/eap610-outdoor/',CURRENT_TIMESTAMP);
