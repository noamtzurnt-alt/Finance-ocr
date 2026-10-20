// Run: npx tsx scripts/test-import-match.ts
import assert from "node:assert/strict";
import { matchKey, pairWithStored, type StoredTx } from "../app/lib/transactions/import-match";

const k = matchKey("2026-10-14", "100", "Cafe");
const row = (card: string | null) => ({ key: k, card });
const pool = (...s: StoredTx[]) => new Map([[k, s]]);
const ids = (r: Array<StoredTx | null>) => r.map((x) => x?.id ?? null);

// first import into an empty app: everything is new
assert.deepEqual(ids(pairWithStored([row("7374")], pool(), new Set())), [null]);

// same file again: the stored row is found, nothing new
assert.deepEqual(ids(pairWithStored([row("7374")], pool({ id: "a", cardLast4: "7374" }), new Set())), ["a"]);

// two identical purchases on the SAME card: both are kept, a third stored match is not invented
assert.deepEqual(
  ids(pairWithStored([row("7374"), row("7374")], pool({ id: "a", cardLast4: "7374" }), new Set())),
  ["a", null],
);
assert.deepEqual(
  ids(pairWithStored([row("7374"), row("7374")], pool({ id: "a", cardLast4: "7374" }, { id: "b", cardLast4: "7374" }), new Set())),
  ["a", "b"],
);

// same vendor, day and amount on two different cards: two separate transactions
assert.deepEqual(
  ids(pairWithStored([row("5622")], pool({ id: "a", cardLast4: "7374" }), new Set())),
  [null],
);
assert.deepEqual(
  ids(pairWithStored([row("7374"), row("5622")], pool({ id: "a", cardLast4: "7374" }), new Set())),
  ["a", null],
);

// typed in the chat without a card: the statement row adopts it instead of duplicating
assert.deepEqual(ids(pairWithStored([row("5622")], pool({ id: "m", cardLast4: null }), new Set())), ["m"]);

// exact card wins over a card-less row when both exist
assert.deepEqual(
  ids(pairWithStored([row("5622")], pool({ id: "m", cardLast4: null }, { id: "x", cardLast4: "5622" }), new Set())),
  ["x"],
);

// a row with no card in the file only pairs with a stored row that has no card or any (single file card)
assert.deepEqual(ids(pairWithStored([row(null)], pool({ id: "a", cardLast4: "7374" }), new Set())), ["a"]);

// continuing with the same `used` set (backfill rows first, then new rows)
const used = new Set<string>();
const p = pool({ id: "a", cardLast4: "7374" });
assert.deepEqual(ids(pairWithStored([row("7374")], p, used)), ["a"]);
assert.deepEqual(ids(pairWithStored([row("7374")], p, used)), [null]);

console.log("import-match: all checks passed");
