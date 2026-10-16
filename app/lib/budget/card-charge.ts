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
  /** YYYY-MM-DD, first purchase day included in this charge. */
  fromDate: string;
  amount: number;
  count: number;
  daysUntil: number;
};

async function chargeFor(
  userId: string,
  today: Date,
  day: number,
  card: string | null,
  cardFilter: Prisma.TransactionWhereInput,
): Promise<UpcomingCardCharge> {
  const monthOffset = today.getUTCDate() <= day ? 0 : 1;
  const chargeDate = utcDate(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, day);
  const from = utcDate(chargeDate.getUTCFullYear(), chargeDate.getUTCMonth() - 1, day);

  const agg = await prisma.transaction.aggregate({
    where: { userId, date: { gte: from, lt: chargeDate }, ...cardFilter },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    card,
    chargeDate: chargeDate.toISOString().slice(0, 10),
    fromDate: from.toISOString().slice(0, 10),
    amount: Number(agg._sum.amount ?? 0),
    count: agg._count._all,
    daysUntil: Math.round((chargeDate.getTime() - today.getTime()) / msPerDay),
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
