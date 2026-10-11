-- Block Supabase's public REST API from the vault tables (Prisma connects as owner and bypasses RLS).
ALTER TABLE "VaultConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VaultKeyWrap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VaultItem" ENABLE ROW LEVEL SECURITY;
