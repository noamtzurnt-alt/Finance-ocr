-- CreateTable
CREATE TABLE "ExpenseFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📁',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "expenseFolderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseFolder_userId_name_key" ON "ExpenseFolder"("userId", "name");
CREATE INDEX "ExpenseFolder_userId_idx" ON "ExpenseFolder"("userId");
CREATE INDEX "Document_userId_expenseFolderId_idx" ON "Document"("userId", "expenseFolderId");

-- AddForeignKey
ALTER TABLE "ExpenseFolder" ADD CONSTRAINT "ExpenseFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseFolderId_fkey" FOREIGN KEY ("expenseFolderId") REFERENCES "ExpenseFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
