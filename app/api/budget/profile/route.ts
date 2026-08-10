import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { syncBudgetCategoriesForUser } from "@/app/lib/categories/budget";
import { wizardStateSchema } from "@/app/lib/budget/wizard-state";

const profileSchema = z.object({
  goal: z.enum([
    "emergency_fund",
    "pay_debt",
    "vacation",
    "financial_independence",
    "business_investment",
  ]).optional(),
  businessRetentionPercent: z.string().optional(),
  checkingBalance: z.string().optional(),
  monthlySavings: z.string().optional(),
  wizardCompleted: z.boolean().optional(),
  personalCategories: z.array(z.string().min(1).max(80)).optional(),
  businessCategories: z.array(z.string().min(1).max(80)).optional(),
  wizardState: z.union([wizardStateSchema, z.null()]).optional(),
});

function parseOptionalMoney(value: string | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null;
  return n.toFixed(2);
}

function parseOptionalPercent(value: string | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n.toFixed(2);
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.financialProfile.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    profile: profile
      ? {
          goal: profile.goal,
          businessRetentionPercent: profile.businessRetentionPercent?.toString() ?? null,
          checkingBalance: profile.checkingBalance?.toString() ?? null,
          monthlySavings: profile.monthlySavings?.toString() ?? null,
          wizardCompletedAt: profile.wizardCompletedAt?.toISOString() ?? null,
          wizardState: profile.wizardState ?? null,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  const checkingBalance = parseOptionalMoney(data.checkingBalance);
  const monthlySavings = parseOptionalMoney(data.monthlySavings);
  const businessRetentionPercent = parseOptionalPercent(data.businessRetentionPercent);

  const profile = await prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: {
      ...(data.goal !== undefined ? { goal: data.goal } : {}),
      ...(businessRetentionPercent !== null
        ? { businessRetentionPercent }
        : data.businessRetentionPercent === ""
          ? { businessRetentionPercent: null }
          : {}),
      ...(checkingBalance !== null
        ? { checkingBalance }
        : data.checkingBalance === ""
          ? { checkingBalance: null }
          : {}),
      ...(monthlySavings !== null
        ? { monthlySavings }
        : data.monthlySavings === ""
          ? { monthlySavings: null }
          : {}),
      ...(data.wizardCompleted ? { wizardCompletedAt: new Date() } : {}),
      ...(data.personalCategories !== undefined
        ? { personalCategories: data.personalCategories }
        : {}),
      ...(data.businessCategories !== undefined
        ? { businessCategories: data.businessCategories }
        : {}),
      ...(data.wizardState !== undefined
        ? {
            wizardState:
              data.wizardState === null
                ? Prisma.JsonNull
                : (data.wizardState as Prisma.InputJsonValue),
            ...(data.wizardState === null ? { wizardCompletedAt: null } : {}),
          }
        : {}),
    },
    create: {
      userId: user.id,
      goal: data.goal ?? null,
      businessRetentionPercent,
      checkingBalance,
      monthlySavings,
      wizardCompletedAt: data.wizardCompleted ? new Date() : null,
      personalCategories: data.personalCategories ?? undefined,
      businessCategories: data.businessCategories ?? undefined,
      wizardState:
        data.wizardState === null || data.wizardState === undefined
          ? undefined
          : (data.wizardState as Prisma.InputJsonValue),
    },
  });

  const catsPersonal =
    data.personalCategories ??
    (data.wizardState && data.wizardState !== null
      ? data.wizardState.answers.expenseRows.map((r) => r.label.trim()).filter(Boolean)
      : undefined);
  const catsBusiness =
    data.businessCategories ??
    (data.wizardState && data.wizardState !== null
      ? data.wizardState.answers.businessExpenseRows.map((r) => r.label.trim()).filter(Boolean)
      : undefined);

  if (catsPersonal || catsBusiness) {
    await syncBudgetCategoriesForUser(user.id, {
      personal: catsPersonal,
      business: catsBusiness,
    });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      goal: profile.goal,
      businessRetentionPercent: profile.businessRetentionPercent?.toString() ?? null,
      checkingBalance: profile.checkingBalance?.toString() ?? null,
      monthlySavings: profile.monthlySavings?.toString() ?? null,
      wizardCompletedAt: profile.wizardCompletedAt?.toISOString() ?? null,
      wizardState: profile.wizardState ?? null,
    },
  });
}
