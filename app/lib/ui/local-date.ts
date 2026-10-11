/** Today's date (YYYY-MM-DD) in the device's own time zone; `toISOString()` would give the UTC date. */
export function todayLocalIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
