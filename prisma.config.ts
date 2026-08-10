
// Ensure .env is loaded even when Prisma config is present.
// Prisma skips its own env loading when `prisma.config.ts` exists, so we load it ourselves.
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Single local config: .env (merged). .env.local optional override for personal tweaks.
loadEnv({ path: ".env", override: false });
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // Migrations need a direct DB connection (Supabase :5432). Pooler :6543 hangs on migrate deploy.
    url: env("DIRECT_URL"),
  },
});
