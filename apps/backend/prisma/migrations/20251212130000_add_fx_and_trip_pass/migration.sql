-- CreateEnum
CREATE TYPE "GroupFxMode" AS ENUM ('FIXED');

-- CreateEnum
CREATE TYPE "SystemExpenseType" AS ENUM ('TRIP_PASS_FEE');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('CREATED', 'PAID', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "Group"
ADD COLUMN     "homeCurrency" TEXT,
ADD COLUMN     "fxMode" "GroupFxMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "fixedFxRates" JSONB,
ADD COLUMN     "fixedFxDate" TIMESTAMP(3),
ADD COLUMN     "fixedFxSource" TEXT;

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN     "originalAmount" DECIMAL(12,2),
ADD COLUMN     "originalCurrency" TEXT,
ADD COLUMN     "fxRate" DECIMAL(18,8),
ADD COLUMN     "fxDate" TIMESTAMP(3),
ADD COLUMN     "fxSource" TEXT,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "systemType" "SystemExpenseType",
ADD COLUMN     "purchaseId" TEXT;

-- Backfill legacy expenses
UPDATE "Expense"
SET
  "originalAmount" = "amount",
  "originalCurrency" = "currency",
  "fxRate" = 1,
  "fxSource" = 'LEGACY'
WHERE "originalAmount" IS NULL;

-- AlterTable
ALTER TABLE "Expense"
ALTER COLUMN "originalAmount" SET NOT NULL,
ALTER COLUMN "originalCurrency" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_purchaseId_key" ON "Expense"("purchaseId");

-- CreateTable
CREATE TABLE "Product" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "starsPrice" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceBySettlementCurrency" JSONB NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "invoicePayload" TEXT NOT NULL,
    "starsAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'CREATED',
    "telegramPaymentChargeId" TEXT,
    "splitCost" BOOLEAN NOT NULL DEFAULT false,
    "settlementFeeAmount" DECIMAL(12,2) NOT NULL,
    "settlementCurrency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "purchaseId" TEXT NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_invoicePayload_key" ON "Purchase"("invoicePayload");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_telegramPaymentChargeId_key" ON "Purchase"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "Purchase_groupId_idx" ON "Purchase"("groupId");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_idx" ON "Purchase"("buyerUserId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_purchaseId_key" ON "Entitlement"("purchaseId");

-- CreateIndex
CREATE INDEX "Entitlement_groupId_productCode_idx" ON "Entitlement"("groupId", "productCode");

-- CreateIndex
CREATE INDEX "Entitlement_endsAt_idx" ON "Entitlement"("endsAt");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "Product"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "Product"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


