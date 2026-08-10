const ALLOWED_PREFIXES = ["image/", "application/pdf"];

export function isContractFile(file: File) {
  if (ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || /\.(jpe?g|png|gif|webp|heic|heif)$/.test(lower);
}
