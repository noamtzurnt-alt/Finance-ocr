-- AlterTable
ALTER TABLE "User" ADD COLUMN "morningWebhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_morningWebhookToken_key" ON "User"("morningWebhookToken");
