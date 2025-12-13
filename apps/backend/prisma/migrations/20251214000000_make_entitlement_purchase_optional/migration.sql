-- AlterTable
ALTER TABLE "Entitlement" ALTER COLUMN "purchaseId" DROP NOT NULL;

-- DropForeignKey (if constraint exists, make optional)
ALTER TABLE "Entitlement" DROP CONSTRAINT IF EXISTS "Entitlement_purchaseId_fkey";

-- AddForeignKey (optional)
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
