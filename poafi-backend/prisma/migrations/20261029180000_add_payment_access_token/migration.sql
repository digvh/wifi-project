-- Protect captive-portal payment polling with a per-payment secret token.
ALTER TABLE "Payment" ADD COLUMN "accessTokenHash" TEXT;

CREATE UNIQUE INDEX "Payment_accessTokenHash_key" ON "Payment"("accessTokenHash");
