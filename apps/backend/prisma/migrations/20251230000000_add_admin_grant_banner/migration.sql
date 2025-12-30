-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN "showAdminGrantBanner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Entitlement" ADD COLUMN "adminGrantBannerShown" BOOLEAN NOT NULL DEFAULT false;

