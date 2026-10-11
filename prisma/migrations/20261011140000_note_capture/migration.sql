-- Backup of note text, kept even if the note row itself never saves.
CREATE TABLE IF NOT EXISTS "NoteCapture" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientKey" TEXT,
  "noteId" TEXT,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoteCapture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NoteCapture_userId_createdAt_idx" ON "NoteCapture"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NoteCapture_userId_clientKey_idx" ON "NoteCapture"("userId", "clientKey");
ALTER TABLE "NoteCapture" ADD CONSTRAINT "NoteCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteCapture" ENABLE ROW LEVEL SECURITY;
