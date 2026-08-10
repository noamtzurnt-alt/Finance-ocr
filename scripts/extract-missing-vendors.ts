import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { prisma } from "../app/lib/prisma";
import { extractVendorFromStoredFile } from "../app/lib/receipts/extract-vendor-from-file";
import { isGeminiConfigured } from "../app/lib/gmail/gemini";

const PLACEHOLDER = new Set(["לא צוין", "לא מוכר", "unknown", "n/a", "-"]);

async function main() {
  console.log("gemini configured:", isGeminiConfigured());
  const docs = await prisma.document.findMany({
    where: { type: "expense" },
    select: { id: true, userId: true, vendor: true, fileName: true, fileMime: true },
    orderBy: { date: "desc" },
    take: 30,
  });
  const targets = docs.filter((d) => {
    const v = d.vendor.trim();
    return !v || PLACEHOLDER.has(v) || PLACEHOLDER.has(v.toLowerCase());
  });
  console.log("expense docs:", docs.length, "missing vendor:", targets.length);
  for (const d of targets) {
    process.stdout.write(`→ ${d.fileName} (${d.fileMime}) ... `);
    const r = await extractVendorFromStoredFile({ userId: d.userId, documentId: d.id });
    if (r.ok) console.log("OK:", r.vendor);
    else console.log("FAIL:", r.reason);
    // Stay under free-tier RPM.
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
