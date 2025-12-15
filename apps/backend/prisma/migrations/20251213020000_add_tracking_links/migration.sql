-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLinkClick" (
    "id" TEXT NOT NULL,
    "trackingLinkId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_code_key" ON "TrackingLink"("code");

-- CreateIndex
CREATE INDEX "TrackingLink_code_idx" ON "TrackingLink"("code");

-- CreateIndex
CREATE INDEX "TrackingLink_createdAt_idx" ON "TrackingLink"("createdAt");

-- CreateIndex
CREATE INDEX "TrackingLinkClick_trackingLinkId_idx" ON "TrackingLinkClick"("trackingLinkId");

-- CreateIndex
CREATE INDEX "TrackingLinkClick_createdAt_idx" ON "TrackingLinkClick"("createdAt");

-- AddForeignKey
ALTER TABLE "TrackingLinkClick" ADD CONSTRAINT "TrackingLinkClick_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;


