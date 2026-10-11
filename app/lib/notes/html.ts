/** Strip dangerous tags/attrs from note HTML. Keeps basic formatting. */
export function sanitizeNoteHtml(raw: string): string {
  const input = raw.trim();
  if (!input) return "";

  // Server-safe: no DOM. Remove scripts/styles/event handlers/javascript URLs.
  let html = input
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<\/?(?:html|body|head|form|input|button|textarea|select)[^>]*>/gi, "");

  // Cap size after sanitize
  if (html.length > 50_000) html = html.slice(0, 50_000);
  return html;
}

/** First line of a note, capped to a few words. This is the list title. */
export function noteTitleFromContent(htmlOrText: string, maxWords = 8): string {
  const text = htmlOrText
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "");
  const firstLine = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (!firstLine) return "";
  const words = firstLine.split(" ");
  if (words.length <= maxWords) return firstLine;
  return words.slice(0, maxWords).join(" ");
}

/** Plain-text snippet for list rows (title companion). */
export function notePlainPreview(htmlOrText: string, maxWords = 12): string {
  const plain = htmlOrText
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  const words = plain.split(" ");
  if (words.length <= maxWords) return plain;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function plainTextToNoteHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n/)
    .map((line) => `<div>${line || "<br>"}</div>`)
    .join("");
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}
