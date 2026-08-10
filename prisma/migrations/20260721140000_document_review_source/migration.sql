-- AlterTable
ALTER TABLE "Document" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Document_userId_type_needsReview_idx" ON "Document"("userId", "type", "needsReview");
