import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { israelToday, utcDate } from "@/app/lib/budget/cycle";

export const CARD_CHARGE_DAY = 15;

/** Cards that are not charged on CARD_CHARGE_DAY, keyed by the stored `cardLast4`. */
export const CARD_CHARGE_DAY_OVERRIDES: Record<string, number> = {
  "9304": 10,
};

export type UpcomingCardCharge = {
  /** Card number for an override card, null for the cards charged on CARD_CHARGE_DAY. */
  card: string | null;
  /** YYYY-MM-DD */
  chargeDate: string;
  /** YYYY-MM-DD, first purchase day of the estimated window. */
  fromDate: string;
  amount: number;
  count: number;
  daysUntil: number;
  /** Purchases whose real charge date came from an imported statement. */
  confirmedCount: number;
  /** Purchases without a real charge date, placed in this charge by the day-of-month rule. */
  estimatedCount: number;
};

async function chargeFor(
  userId: string,
  today: Date,
  day: number,
  card: string | null,
  cardFilter: Prisma.TransactionWhereInput,
): Promise<UpcomingCardCharge> {
  // A charge date learned from an imported statement beats the day-of-month rule.
  const known = await prisma.transaction.findFirst({
    where: { userId, chargeDate: { gte: today }, ...cardFilter },
    orderBy: { chargeDate: "asc" },
    select: { chargeDate: true },
  });

  const monthOffset = today.getUTCDate() <= day ? 0 : 1;
  const ruleDate = utcDate(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, day);
  const chargeDate = known?.chargeDate ?? ruleDate;
  const from = utcDate(chargeDate.getUTCFullYear(), chargeDate.getUTCMonth() - 1, chargeDate.getUTCDate());

  const [confirmed, estimated] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, chargeDate, ...cardFilter },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, chargeDate: null, date: { gte: from, lt: chargeDate }, ...cardFilter },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    card,
    chargeDate: chargeDate.toISOString().slice(0, 10),
    fromDate: from.toISOString().slice(0, 10),
    amount: Number(confirmed._sum.amount ?? 0) + Number(estimated._sum.amount ?? 0),
    count: confirmed._count._all + estimated._count._all,
    daysUntil: Math.round((chargeDate.getTime() - today.getTime()) / msPerDay),
    confirmedCount: confirmed._count._all,
    estimatedCount: estimated._count._all,
  };
}

/**
 * Next charge of each card group, soonest first: every purchase since the previous
 * charge day (inclusive) up to the day before the next one. Override cards with no
 * purchases in their window are left out.
 */
export async function getUpcomingCardCharges(userId: string, now = new Date()): Promise<UpcomingCardCharge[]> {
  const today = israelToday(now);
  const overrideCards = Object.keys(CARD_CHARGE_DAY_OVERRIDES);

  const [main, ...overrides] = await Promise.all([
    chargeFor(userId, today, CARD_CHARGE_DAY, null, {
      OR: [{ cardLast4: null }, { cardLast4: { notIn: overrideCards } }],
    }),
    ...overrideCards.map((card) =>
      chargeFor(userId, today, CARD_CHARGE_DAY_OVERRIDES[card], card, { cardLast4: card }),
    ),
  ]);

  return [main, ...overrides.filter((c) => c.count > 0)].sort((a, b) => a.daysUntil - b.daysUntil);
}
