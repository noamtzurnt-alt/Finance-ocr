import { prisma } from "@/app/lib/prisma";
import { israelToday, utcDate } from "@/app/lib/budget/cycle";

export const CARD_CHARGE_DAY = 15;

export type UpcomingCardCharge = {
  /** YYYY-MM-DD */
  chargeDate: string;
  /** YYYY-MM-DD, first purchase day included in this charge. */
  fromDate: string;
  amount: number;
  count: number;
  daysUntil: number;
};

/** Next card charge: every purchase since the previous charge day (inclusive) up to the day before the next one. */
export async function getUpcomingCardCharge(userId: string, now = new Date()): Promise<UpcomingCardCharge> {
  const today = israelToday(now);
  const monthOffset = today.getUTCDate() <= CARD_CHARGE_DAY ? 0 : 1;
  const chargeDate = utcDate(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, CARD_CHARGE_DAY);
  const from = utcDate(chargeDate.getUTCFullYear(), chargeDate.getUTCMonth() - 1, CARD_CHARGE_DAY);

  const agg = await prisma.transaction.aggregate({
    where: { userId, date: { gte: from, lt: chargeDate } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    chargeDate: chargeDate.toISOString().slice(0, 10),
    fromDate: from.toISOString().slice(0, 10),
    amount: Number(agg._sum.amount ?? 0),
    count: agg._count._all,
    daysUntil: Math.round((chargeDate.getTime() - today.getTime()) / msPerDay),
  };
}
