-- CreateTable
CREATE TABLE "NoteFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteFolder_userId_idx" ON "NoteFolder"("userId");

-- AddForeignKey
ALTER TABLE "NoteFolder" ADD CONSTRAINT "NoteFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "folderId" TEXT;
ALTER TABLE "Note" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Note_folderId_idx" ON "Note"("folderId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Block Supabase's public REST API (Prisma connects as owner and bypasses RLS).
ALTER TABLE "NoteFolder" ENABLE ROW LEVEL SECURITY;
