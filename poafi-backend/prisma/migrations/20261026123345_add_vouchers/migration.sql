-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "encryptedCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
