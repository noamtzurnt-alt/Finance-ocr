-- CreateTable
CREATE TABLE "VaultFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultFolder_userId_idx" ON "VaultFolder"("userId");

-- AddForeignKey
ALTER TABLE "VaultFolder" ADD CONSTRAINT "VaultFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "VaultItem" ADD COLUMN "folderId" TEXT;
ALTER TABLE "VaultItem" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VaultItem_folderId_idx" ON "VaultItem"("folderId");

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "VaultFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Block Supabase's public REST API (Prisma connects as owner and bypasses RLS).
ALTER TABLE "VaultFolder" ENABLE ROW LEVEL SECURITY;
