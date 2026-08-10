-- AlterTable
ALTER TABLE "Contract"
ADD COLUMN "clientEmail" TEXT,
ADD COLUMN "emailHtmlKey" TEXT,
ADD COLUMN "emailHtmlFileName" TEXT,
ADD COLUMN "emailHtmlSize" INTEGER,
ADD COLUMN "gmailConnectionId" TEXT,
ADD COLUMN "gmailMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_gmailConnectionId_gmailMessageId_key"
ON "Contract"("gmailConnectionId", "gmailMessageId");
