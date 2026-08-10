import { prisma } from "@/app/lib/prisma";
import type { BudgetScope } from "@prisma/client";

export const DEFAULT_PERSONAL_BUDGET_CATEGORIES = [
  "דלק/רכב",
  "אוכל",
  "בזבוזים",
  "יום הולדת/אירוע מיוחד",
  "ספר",
  "רכבת",
] as const;

export const DEFAULT_BUSINESS_BUDGET_CATEGORIES = [
  "תוכנות ומנויים",
  "מספרי טלפון",
  "דומיין",
  "עלות הודעות ווצאפ",
  "עלות רואה חשבון",
] as const;

/** Old app / budget naming → canonical budget label */
export const BUDGET_CATEGORY_ALIASES: Record<string, string> = {
  "תוכנות/מנויים": "תוכנות ומנויים",
  "רכב/דלק": "דלק/רכב",
  "בילויים": "בזבוזים",
};

export const ALL_BUDGET_CATEGORY_NAMES = [
  ...DEFAULT_PERSONAL_BUDGET_CATEGORIES,
  ...DEFAULT_BUSINESS_BUDGET_CATEGORIES,
] as const;

function cleanNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = BUDGET_CATEGORY_ALIASES[raw.trim()] ?? raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function resolveBudgetCategoryLists(opts?: {
  personal?: string[] | null;
  business?: string[] | null;
}): { personal: string[]; business: string[] } {
  const personal = cleanNames(
    opts?.personal?.length ? opts.personal : [...DEFAULT_PERSONAL_BUDGET_CATEGORIES],
  );
  const business = cleanNames(
    opts?.business?.length ? opts.business : [...DEFAULT_BUSINESS_BUDGET_CATEGORIES],
  );
  return { personal, business };
}

export async function syncBudgetCategoriesForUser(
  userId: string,
  opts?: { personal?: string[] | null; business?: string[] | null },
) {
  const { personal, business } = resolveBudgetCategoryLists(opts);
  const businessSet = new Set(business);

  for (const [legacyName, canonicalName] of Object.entries(BUDGET_CATEGORY_ALIASES)) {
    const scope: BudgetScope = businessSet.has(canonicalName) ? "business" : "personal";
    const targetExists = await prisma.category.findFirst({
      where: { userId, name: canonicalName },
      select: { id: true },
    });
    if (targetExists) {
      await prisma.category.deleteMany({ where: { userId, name: legacyName } });
    } else {
      await prisma.category.updateMany({
        where: { userId, name: legacyName },
        data: { name: canonicalName, budgetScope: scope },
      });
    }
  }

  async function ensure(name: string, scope: BudgetScope) {
    const existing = await prisma.category.findFirst({
      where: { userId, name },
      select: { id: true, budgetScope: true },
    });
    if (existing) {
      if (existing.budgetScope !== scope) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { budgetScope: scope },
        });
      }
      return;
    }
    await prisma.category.create({
      data: { userId, name, budgetScope: scope },
    });
  }

  for (const name of personal) await ensure(name, "personal");
  for (const name of business) await ensure(name, "business");
}

export type BudgetCategory = {
  id: string;
  name: string;
  budgetScope: BudgetScope;
};
