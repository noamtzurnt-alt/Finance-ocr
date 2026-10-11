-- Last notes location, shared between phone and computer.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notesPlace" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notesPlaceAt" TIMESTAMP(3);
