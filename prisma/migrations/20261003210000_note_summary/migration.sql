-- AlterTable
ALTER TABLE "Note" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Note" ADD COLUMN "summaryHash" TEXT;
