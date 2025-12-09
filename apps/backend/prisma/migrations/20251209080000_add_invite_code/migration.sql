-- AlterTable
ALTER TABLE "Group" ADD COLUMN "inviteCode" TEXT;

-- Заполняем существующие записи уникальными UUID
UPDATE "Group" SET "inviteCode" = gen_random_uuid()::text WHERE "inviteCode" IS NULL;

-- Делаем поле обязательным и уникальным
ALTER TABLE "Group" ALTER COLUMN "inviteCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteCode_key" ON "Group"("inviteCode");

