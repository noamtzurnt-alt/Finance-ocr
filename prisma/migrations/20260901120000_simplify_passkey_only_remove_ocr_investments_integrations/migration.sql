-- DropForeignKey
ALTER TABLE "EmailReceiptImport" DROP CONSTRAINT "EmailReceiptImport_gmailConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "EmailReceiptImport" DROP CONSTRAINT "EmailReceiptImport_userId_fkey";

-- DropForeignKey
ALTER TABLE "GmailConnection" DROP CONSTRAINT "GmailConnection_userId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentAccount" DROP CONSTRAINT "InvestmentAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentEntry" DROP CONSTRAINT "InvestmentEntry_accountId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentEntry" DROP CONSTRAINT "InvestmentEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentYear" DROP CONSTRAINT "InvestmentYear_accountId_fkey";

-- DropForeignKey
ALTER TABLE "InvestmentYear" DROP CONSTRAINT "InvestmentYear_userId_fkey";

-- DropForeignKey
ALTER TABLE "MorningWebhookEvent" DROP CONSTRAINT "MorningWebhookEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "OcrJob" DROP CONSTRAINT "OcrJob_docId_fkey";

-- DropForeignKey
ALTER TABLE "OcrJob" DROP CONSTRAINT "OcrJob_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordReset" DROP CONSTRAINT "PasswordReset_userId_fkey";

-- DropIndex
DROP INDEX "Contract_gmailConnectionId_gmailMessageId_key";

-- DropIndex
DROP INDEX "User_morningWebhookToken_key";

-- DropIndex
DROP INDEX "User_phoneNumber_key";

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "emailHtmlFileName",
DROP COLUMN "emailHtmlKey",
DROP COLUMN "emailHtmlSize",
DROP COLUMN "gmailConnectionId",
DROP COLUMN "gmailMessageId";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "ocrConfidence",
DROP COLUMN "ocrStatus",
DROP COLUMN "ocrText";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "isFixed";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "approved",
DROP COLUMN "externalId",
DROP COLUMN "isAdmin",
DROP COLUMN "morningWebhookSecret",
DROP COLUMN "morningWebhookToken",
DROP COLUMN "passwordHash",
DROP COLUMN "phoneNumber",
DROP COLUMN "whatsappIncomingNumber";

-- DropTable
DROP TABLE "EmailReceiptImport";

-- DropTable
DROP TABLE "GmailConnection";

-- DropTable
DROP TABLE "InvestmentAccount";

-- DropTable
DROP TABLE "InvestmentEntry";

-- DropTable
DROP TABLE "InvestmentYear";

-- DropTable
DROP TABLE "MorningWebhookEvent";

-- DropTable
DROP TABLE "OcrJob";

-- DropTable
DROP TABLE "PasswordReset";

-- DropEnum
DROP TYPE "InvestmentAccountType";

-- DropEnum
DROP TYPE "InvestmentEntryType";

-- DropEnum
DROP TYPE "OcrJobStatus";

-- DropEnum
DROP TYPE "OcrStatus";

