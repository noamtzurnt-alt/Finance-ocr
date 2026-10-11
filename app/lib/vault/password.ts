function randomInt(n: number): number {
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % n);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}

export function generatePassword(opts: { length: number; digits: boolean; symbols: boolean }): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+?";
  const sets = [lower, upper, ...(opts.digits ? [digits] : []), ...(opts.symbols ? [symbols] : [])];
  const all = sets.join("");
  const length = Math.max(sets.length, opts.length);

  const pick = (pool: string) => pool[randomInt(pool.length)]!;
  const out = sets.map(pick);
  while (out.length < length) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.join("");
}
