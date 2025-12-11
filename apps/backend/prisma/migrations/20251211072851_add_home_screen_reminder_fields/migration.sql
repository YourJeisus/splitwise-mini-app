-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstVisitAt" TIMESTAMP(3),
ADD COLUMN     "homeScreenReminderSent" BOOLEAN NOT NULL DEFAULT false;
