type Scope = "personal" | "business";

export type ClassificationCategory = {
  id: string;
  name: string;
  budgetScope: Scope;
};

export type ClassifiedTransaction = {
  categoryId: string | null;
  categoryName: string | null;
  categoryScope: Scope | null;
  confidence: "high" | "medium" | "unclassified";
  reason: string;
};

type HistoryRow = {
  vendor: string;
  categoryId: string | null;
};

const RULES: Array<{ pattern: RegExp; categoryNames: string[] }> = [
  {
    pattern:
      /cursor|anthropic|claude|openai|chatgpt|gemini|google workspace|adobe|canva|capcut|vercel|github|microsoft 365|zoom|dropbox/i,
    categoryNames: ["תוכנות ומנויים", "תוכנות/מנויים"],
  },
  {
    pattern: /namecheap|godaddy|cloudflare|domain|דומיין|livedns|internic/i,
    categoryNames: ["דומיין", "דומיינים"],
  },
  {
    pattern: /twilio|green api|whatsapp|ווטסאפ|וואטסאפ/i,
    categoryNames: ["עלות הודעות ווצאפ"],
  },
  {
    pattern: /רואה חשבון|ראיית חשבון|accounting|accountant|cpa/i,
    categoryNames: ["עלות רואה חשבון"],
  },
  {
    pattern: /רכבת ישראל|israel railways|רב.?קו|rav.?kav/i,
    categoryNames: ["רכבת"],
  },
  {
    pattern: /פז|paz|סונול|sonol|דלק|delek|דור אלון|dor alon|ten |טן |yellow/i,
    categoryNames: ["דלק/רכב", "רכב/דלק"],
  },
  {
    pattern: /סטימצקי|צומת ספרים|steimatzky|book depository|עברית ספרים/i,
    categoryNames: ["ספר"],
  },
  {
    pattern: /wolt|וולט|תן ביס|10bis|משלוחה|mishloha/i,
    categoryNames: ["אוכל"],
  },
];

export function normalizeVendor(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b(?:ltd|inc|llc|co)\b/gi, " ")
    .replace(/בע[\"״']?מ/g, " ")
    .replace(/\d{4,}/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryByNames(categories: ClassificationCategory[], names: string[]) {
  const wanted = new Set(names.map((name) => name.trim().toLowerCase()));
  return categories.find((category) => wanted.has(category.name.trim().toLowerCase())) ?? null;
}

export function classifyTransactions(params: {
  vendors: string[];
  categories: ClassificationCategory[];
  history: HistoryRow[];
}): ClassifiedTransaction[] {
  const categoryById = new Map(params.categories.map((category) => [category.id, category]));
  const historyCounts = new Map<string, Map<string, number>>();

  for (const row of params.history) {
    if (!row.categoryId || !categoryById.has(row.categoryId)) continue;
    const vendor = normalizeVendor(row.vendor);
    if (!vendor) continue;
    const counts = historyCounts.get(vendor) ?? new Map<string, number>();
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    historyCounts.set(vendor, counts);
  }

  return params.vendors.map((rawVendor) => {
    const vendor = normalizeVendor(rawVendor);
    const counts = historyCounts.get(vendor);
    if (counts?.size) {
      const [categoryId, uses] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const category = categoryById.get(categoryId)!;
      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryScope: category.budgetScope,
        confidence: "high",
        reason: `לפי ${uses} תנועות קודמות מאותו בית עסק`,
      };
    }

    for (const rule of RULES) {
      if (!rule.pattern.test(`${rawVendor} ${vendor}`)) continue;
      const category = categoryByNames(params.categories, rule.categoryNames);
      if (!category) continue;
      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryScope: category.budgetScope,
        confidence: "medium",
        reason: "זוהה לפי סוג בית העסק",
      };
    }

    return {
      categoryId: null,
      categoryName: null,
      categoryScope: null,
      confidence: "unclassified",
      reason: "אין מספיק מידע לסיווג בטוח",
    };
  });
}
