export const EMAIL_INBOX_FOLDER_NAME = "מהמייל";

const RECEIPT_KEYWORDS = [
  "receipt",
  "invoice",
  "payment",
  "billing",
  "subscription",
  "order confirmation",
  "purchase",
  "tax invoice",
  "payment received",
  "your receipt",
  "קבלה",
  "חשבונית",
  "תשלום",
  "חיוב",
  "רכישה",
  "אישור הזמנה",
  "חשבון",
  "מסמך",
];

const ATTACHMENT_NAME_HINTS = [
  "receipt",
  "invoice",
  "bill",
  "קבלה",
  "חשבונית",
  "tax",
  "payment",
];

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isAllowedAttachmentMime(mime: string, fileName: string) {
  const m = mime.toLowerCase();
  if (ALLOWED_MIMES.has(m)) return true;
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    /\.(jpe?g|png|webp|heic|heif)$/.test(lower)
  );
}

export function scoreReceiptCandidate(input: {
  subject: string;
  snippet: string;
  attachmentNames: string[];
  hasAllowedAttachment: boolean;
}) {
  const hay = `${input.subject} ${input.snippet}`.toLowerCase();
  let score = 0;

  if (RECEIPT_KEYWORDS.some((k) => hay.includes(k.toLowerCase()))) score += 2;
  if (input.hasAllowedAttachment) score += 2;
  if (
    input.attachmentNames.some((n) =>
      ATTACHMENT_NAME_HINTS.some((h) => n.toLowerCase().includes(h)),
    )
  ) {
    score += 2;
  }

  return score;
}

export function isReceiptCandidate(input: Parameters<typeof scoreReceiptCandidate>[0]) {
  return scoreReceiptCandidate(input) >= 2;
}

export function parseSenderName(fromHeader: string) {
  const m = fromHeader.match(/^"?([^"<]+)"?\s*</);
  if (m?.[1]) return m[1].trim().slice(0, 120);
  const email = fromHeader.match(/<([^>]+)>/)?.[1] || fromHeader;
  return email.split("@")[0]?.slice(0, 120) || "לא צוין";
}

export function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function buildEmailReceiptHtml(input: {
  from: string;
  subject: string;
  date: string;
  bodyHtml: string;
}) {
  const body = sanitizeEmailHtml(input.bodyHtml || "<p>אין תוכן HTML</p>");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.subject)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #18181b; }
    .meta { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
    .meta dt { font-size: 12px; color: #71717a; margin-top: 0.5rem; }
    .meta dd { margin: 0; font-weight: 600; }
    .content { border-top: 1px solid #e4e4e7; padding-top: 1rem; }
  </style>
</head>
<body>
  <div class="meta">
    <dl>
      <dt>שולח</dt><dd>${escapeHtml(input.from)}</dd>
      <dt>נושא</dt><dd>${escapeHtml(input.subject)}</dd>
      <dt>תאריך</dt><dd>${escapeHtml(input.date)}</dd>
    </dl>
  </div>
  <div class="content">${body}</div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function gmailQueryAfter(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `after:${y}/${m}/${d}`;
}
