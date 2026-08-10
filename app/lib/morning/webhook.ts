import crypto from "crypto";

/** Morning document types we import as payment receipts (קבלות הכנסה). */
export const MORNING_RECEIPT_TYPES = new Set([
  400, // קבלה
  405, // קבלה על תרומה
  320, // חשבונית מס / קבלה
]);

/** Hebrew names for Morning document types (per Morning docs). */
export const MORNING_TYPE_LABELS: Record<number, string> = {
  10: "הצעת מחיר",
  100: "הזמנה",
  200: "תעודת משלוח",
  210: "תעודת החזרה",
  300: "חשבון עסקה",
  305: "חשבונית מס",
  320: "חשבונית מס / קבלה",
  330: "חשבונית זיכוי",
  400: "קבלה",
  405: "קבלה על תרומה",
  500: "הזמנת רכש",
  600: "קבלת פיקדון",
  610: "משיכת פיקדון",
};

export function morningTypeLabel(type: number): string {
  return MORNING_TYPE_LABELS[type] ?? `סוג ${type}`;
}

export type MorningDocumentPayload = {
  id?: string;
  type?: number;
  number?: number | string;
  currency?: string;
  date?: string;
  total?: number;
  description?: string;
  recipient?: { name?: string; emails?: string[] };
  files?: {
    signed?: boolean;
    downloadLinks?: { he?: string; origin?: string; en?: string };
  };
};

export function extractMorningDocument(body: unknown): MorningDocumentPayload | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;

  // Wrapped: { topic, data } or { event, document }
  if (obj.data && typeof obj.data === "object") {
    return obj.data as MorningDocumentPayload;
  }
  if (obj.document && typeof obj.document === "object") {
    return obj.document as MorningDocumentPayload;
  }
  // Raw document payload
  if (obj.id || obj.type != null || obj.files) {
    return obj as MorningDocumentPayload;
  }
  return null;
}

export function morningFileName(doc: MorningDocumentPayload) {
  const id = (doc.id ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const num = doc.number != null ? String(doc.number) : "doc";
  return `morning-${num}-${id}.pdf`;
}

/** Hosts Morning / Green Invoice use for document PDF download links. */
const MORNING_DOWNLOAD_HOST_SUFFIXES = [
  ".greeninvoice.co.il",
  ".morning.co.il",
] as const;

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isAllowedMorningHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "greeninvoice.co.il" || host === "www.greeninvoice.co.il") return true;
  if (host === "morning.co.il" || host === "www.morning.co.il") return true;
  return MORNING_DOWNLOAD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isBlockedIpLiteral(hostname: string) {
  // Block dotted IPv4 / bracket IPv6 hostnames outright (no IP literals as download targets).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.includes(":")) return true;
  return false;
}

/**
 * Reject non-HTTPS, non-Morning hosts, credentials-in-URL, and IP literals (SSRF guard).
 * Call before every fetch, including each redirect Location.
 */
export function assertSafeMorningDownloadUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid Morning PDF URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Morning PDF URL must be HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Morning PDF URL must not include credentials");
  }
  if (isBlockedIpLiteral(url.hostname) || !isAllowedMorningHost(url.hostname)) {
    throw new Error(`Morning PDF host not allowed: ${url.hostname}`);
  }
  return url;
}

export async function downloadMorningPdf(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  let current = assertSafeMorningDownloadUrl(url).toString();

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      headers: { Accept: "application/pdf,*/*" },
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Morning PDF redirect without Location (${res.status})`);
      // Relative redirects resolve against current URL; absolute ones are re-validated.
      current = assertSafeMorningDownloadUrl(new URL(location, current).toString()).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Morning PDF download failed: ${res.status}`);
    }

    const lenHeader = res.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > MAX_PDF_BYTES) {
      throw new Error("Morning PDF too large");
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_PDF_BYTES) {
      throw new Error("Morning PDF too large");
    }
    const contentType = res.headers.get("content-type") ?? "application/pdf";
    return { buffer, contentType };
  }

  throw new Error("Morning PDF too many redirects");
}

export function newMorningWebhookToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function newMorningWebhookSecret() {
  // Keep short — Morning UI rejects very long secrets ("Invalid secret value")
  return crypto.randomBytes(16).toString("base64url");
}

function timingSafeEqualStr(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function hmacHex(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function hmacBase64(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

/**
 * Verify Morning webhook Secret.
 * Accepts: query ?secret=, common headers, or HMAC in X-Data-Signature / X-Hub-Signature-256.
 */
export function verifyMorningWebhookSecret(opts: {
  secret: string;
  querySecret: string | null;
  headers: Headers;
  rawBody: string;
}): boolean {
  const { secret, querySecret, headers, rawBody } = opts;

  if (querySecret && timingSafeEqualStr(querySecret, secret)) {
    return true;
  }

  const headerCandidates = [
    headers.get("x-webhook-secret"),
    headers.get("x-secret"),
    headers.get("x-greeninvoice-secret"),
    headers.get("x-morning-secret"),
  ];

  const auth = headers.get("authorization");
  if (auth) {
    const lower = auth.toLowerCase();
    if (lower.startsWith("bearer ")) {
      headerCandidates.push(auth.slice(7).trim());
    } else if (lower.startsWith("basic ")) {
      try {
        const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
        // user:password or :password
        const pass = decoded.includes(":") ? decoded.slice(decoded.indexOf(":") + 1) : decoded;
        headerCandidates.push(pass);
        headerCandidates.push(decoded);
      } catch {
        // ignore
      }
    }
  }

  for (const candidate of headerCandidates) {
    if (candidate && timingSafeEqualStr(candidate, secret)) return true;
  }

  const sigHeaders = [
    headers.get("x-data-signature"),
    headers.get("x-hub-signature-256"),
    headers.get("x-hub-signature"),
  ];

  for (const sig of sigHeaders) {
    if (!sig) continue;
    const clean = sig.replace(/^sha256=/i, "").trim();
    const expectedHex = hmacHex(secret, rawBody);
    const expectedB64 = hmacBase64(secret, rawBody);
    if (timingSafeEqualStr(clean, expectedHex) || timingSafeEqualStr(clean, expectedB64)) {
      return true;
    }
  }

  return false;
}
