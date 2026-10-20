export type StoredTx = { id: string; cardLast4: string | null };

/** Same purchase day, amount and vendor. The card is compared separately in `pairWithStored`. */
export function matchKey(date: string, amount: string, vendor: string) {
  return `${date}|${Number(amount).toFixed(2)}|${vendor.trim().toLowerCase()}`;
}

/**
 * Pairs each statement row with at most one stored transaction, one-to-one.
 * - Two identical rows only pair with two stored ones, so a repeat purchase is never swallowed.
 * - A row on a known card never pairs with a stored transaction on another known card.
 * - A stored transaction without a card (typed in the chat) can pair with any card.
 * `used` carries ids that were already paired, so call it again with the same set to continue.
 */
export function pairWithStored<T extends { key: string; card: string | null }>(
  rows: T[],
  pool: Map<string, StoredTx[]>,
  used: Set<string>,
): Array<StoredTx | null> {
  return rows.map((row) => {
    const candidates = (pool.get(row.key) ?? []).filter((s) => !used.has(s.id));
    const pick =
      candidates.find((s) => row.card != null && s.cardLast4 === row.card) ??
      candidates.find((s) => s.cardLast4 == null) ??
      (row.card == null ? candidates[0] : undefined);
    if (!pick) return null;
    used.add(pick.id);
    return pick;
  });
}
