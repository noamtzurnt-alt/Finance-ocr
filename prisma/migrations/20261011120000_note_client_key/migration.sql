-- Lets the phone retry a note save without creating a second copy.
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "clientKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Note_userId_clientKey_key" ON "Note"("userId", "clientKey");
