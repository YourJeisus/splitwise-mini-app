-- AlterTable: Add support fields to AdminUser
ALTER TABLE "AdminUser" ADD COLUMN "telegramUserId" TEXT,
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "supportNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Add unique constraints
CREATE UNIQUE INDEX "AdminUser_telegramUserId_key" ON "AdminUser"("telegramUserId");
CREATE UNIQUE INDEX "AdminUser_telegramChatId_key" ON "AdminUser"("telegramChatId");

-- CreateEnum: SupportStatus
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum: MessageDirection
CREATE TYPE "MessageDirection" AS ENUM ('USER', 'ADMIN');

-- CreateTable: SupportTicket
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SupportMessage
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "telegramMessageId" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminNotification
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminTelegramLinkToken
CREATE TABLE "AdminTelegramLinkToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SupportTicket
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_assignedAdminId_idx" ON "SupportTicket"("assignedAdminId");

-- CreateIndex: SupportMessage
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex: AdminNotification
CREATE INDEX "AdminNotification_adminId_idx" ON "AdminNotification"("adminId");
CREATE INDEX "AdminNotification_read_idx" ON "AdminNotification"("read");
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex: AdminTelegramLinkToken
CREATE UNIQUE INDEX "AdminTelegramLinkToken_token_key" ON "AdminTelegramLinkToken"("token");
CREATE INDEX "AdminTelegramLinkToken_token_idx" ON "AdminTelegramLinkToken"("token");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminTelegramLinkToken" ADD CONSTRAINT "AdminTelegramLinkToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

