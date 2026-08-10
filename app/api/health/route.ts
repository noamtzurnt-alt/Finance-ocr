import { NextResponse } from "next/server";

function isSet(name: string) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export async function GET() {
  const checks = {
    DATABASE_URL: isSet("DATABASE_URL"),
    AUTH_SECRET: isSet("AUTH_SECRET"),

    R2_ACCOUNT_ID: isSet("R2_ACCOUNT_ID"),
    R2_ACCESS_KEY_ID: isSet("R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: isSet("R2_SECRET_ACCESS_KEY"),
    R2_BUCKET: isSet("R2_BUCKET"),

    CRON_SECRET: isSet("CRON_SECRET"),
  };

  const ok =
    checks.DATABASE_URL &&
    checks.AUTH_SECRET &&
    checks.R2_ACCOUNT_ID &&
    checks.R2_ACCESS_KEY_ID &&
    checks.R2_SECRET_ACCESS_KEY &&
    checks.R2_BUCKET &&
    checks.CRON_SECRET;
  return NextResponse.json({ ok, checks });
}
