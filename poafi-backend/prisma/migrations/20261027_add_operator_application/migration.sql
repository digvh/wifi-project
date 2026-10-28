CREATE TABLE "OperatorApplication" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    CONSTRAINT "OperatorApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorApplication_email_key" ON "OperatorApplication"("email");
