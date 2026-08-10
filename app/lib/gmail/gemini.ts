import { isReceiptCandidate, parseSenderName } from "./detect";

export type ReceiptAnalysis = {
  isReceipt: boolean;
  vendor: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string | null;
  date: string | null; // YYYY-MM-DD
  downloadUrl: string | null;
  source: "gemini" | "heuristic";
};

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
}

export function isGeminiConfigured() {
  return Boolean(geminiApiKey());
}

/** Extract likely receipt/invoice download links from an email HTML/text body. */
export function extractReceiptLinks(body: string): string[] {
  if (!body) return [];
  const urls = new Set<string>();

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const candidates: Array<{ url: string; text: string }> = [];

  while ((m = hrefRe.exec(body))) {
    const url = m[1];
    if (/^https?:\/\//i.test(url)) {
      // capture some anchor text after the href for keyword matching
      const after = body.slice(m.index, m.index + 400);
      candidates.push({ url, text: after });
    }
  }

  // also bare urls in text
  const bareRe = /(https?:\/\/[^\s"'<>]+)/gi;
  while ((m = bareRe.exec(body))) {
    candidates.push({ url: m[1], text: body.slice(m.index, m.index + 200) });
  }

  const LINK_HINTS =
    /(invoice|receipt|download|view.?(invoice|receipt|bill)|billing|חשבונית|קבלה|להורדת|צפ[הי]ה?|הורד)/i;
  const HOST_HINTS =
    /(invoice|receipt|billing|stripe|paddle|invoice4u|greeninvoice|morning|ezcount|sumit|icount|payplus|tranzila)/i;

  for (const c of candidates) {
    if (LINK_HINTS.test(c.text) || HOST_HINTS.test(c.url)) {
      urls.add(c.url);
    }
  }

  return [...urls].slice(0, 5);
}

function heuristicAnalysis(input: {
  subject: string;
  snippet: string;
  from: string;
  attachmentNames: string[];
  hasAllowedAttachment: boolean;
  body: string;
}): ReceiptAnalysis {
  const isReceipt = isReceiptCandidate({
    subject: input.subject,
    snippet: input.snippet,
    attachmentNames: input.attachmentNames,
    hasAllowedAttachment: input.hasAllowedAttachment,
  });
  const links = extractReceiptLinks(input.body);
  return {
    isReceipt,
    vendor: parseSenderName(input.from),
    totalAmount: null,
    vatAmount: null,
    currency: null,
    date: null,
    downloadUrl: links[0] ?? null,
    source: "heuristic",
  };
}

/** Gemini vision supports these inline mime types. HEIC/HEIF are not supported. */
function geminiVisionMime(mime: string, fileName: string): string | null {
  const m = mime.toLowerCase();
  if (m === "application/pdf") return "application/pdf";
  if (m === "image/jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/webp") return "image/webp";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export type FileReceiptAnalysis = {
  vendor: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string | null;
  date: string | null; // YYYY-MM-DD
};

function parseLooseJson(text: string): Record<string, unknown> | null {
  let jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    // Models sometimes truncate the closing brace(s).
    const repaired = `${jsonText}${"}".repeat(Math.max(0, (jsonText.match(/{/g) || []).length - (jsonText.match(/}/g) || []).length))}`;
    try {
      return JSON.parse(repaired) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function fileAnalysisFromParsed(parsed: Record<string, unknown>): FileReceiptAnalysis {
  return {
    vendor:
      typeof parsed.vendor === "string" && parsed.vendor.trim()
        ? parsed.vendor.trim().slice(0, 200)
        : null,
    totalAmount: coerceNumber(parsed.total_amount),
    vatAmount: coerceNumber(parsed.vat_amount),
    currency:
      typeof parsed.currency === "string" ? parsed.currency.trim().toUpperCase().slice(0, 3) : null,
    date: coerceDate(parsed.date),
  };
}

async function geminiGenerateJson(parts: Array<Record<string, unknown>>): Promise<Record<string, unknown> | null> {
  const key = geminiApiKey();
  if (!key) return null;

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 512,
    },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

  async function once() {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    return res;
  }

  let res = await once();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 20000));
    res = await once();
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseLooseJson(text);
}

/**
 * Extract structured receipt fields directly from the receipt file (PDF/image)
 * using Gemini multimodal vision. Returns null on any error/quota/unsupported type.
 */
export async function analyzeReceiptFile(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<FileReceiptAnalysis | null> {
  if (!geminiApiKey()) return null;

  const visionMime = geminiVisionMime(input.mimeType, input.fileName);
  if (!visionMime) return null;

  // Guard against oversized inline payloads (~20MB request limit for inline data).
  if (input.buffer.length > 15 * 1024 * 1024) return null;

  const prompt = `You are a bookkeeping assistant. This file is a business expense receipt or tax invoice. Read it and extract the details.

Return STRICT JSON only, no markdown, with this shape:
{"vendor": string|null, "total_amount": number|null, "vat_amount": number|null, "currency": string|null, "date": "YYYY-MM-DD"|null}

- vendor: the merchant/company/business name that ISSUED the receipt (the seller), exactly as printed. Prefer the trade/brand name over legal entity if both appear. Do NOT return the buyer/customer name.
- currency: ISO code like ILS, USD, EUR.
- total_amount: the final total paid (including VAT if shown).
- vat_amount: the VAT/tax amount if shown.
- date: the exact receipt/invoice ISSUE DATE printed on the document. Do not use
  the payment due date, card charge date, document scan date, or email date.
  If several dates appear, choose the one explicitly labelled as document,
  invoice, receipt, issue, or transaction date. Return null if it is unreadable
  or ambiguous rather than guessing.`;

  try {
    const parsed = await geminiGenerateJson([
      { text: prompt },
      { inlineData: { mimeType: visionMime, data: input.buffer.toString("base64") } },
    ]);
    if (!parsed) return null;
    return fileAnalysisFromParsed(parsed);
  } catch {
    return null;
  }
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Classify + extract via Gemini free tier. Falls back to heuristics on any error/quota.
 */
export async function analyzeReceiptEmail(input: {
  subject: string;
  snippet: string;
  from: string;
  attachmentNames: string[];
  hasAllowedAttachment: boolean;
  body: string;
}): Promise<ReceiptAnalysis> {
  const key = geminiApiKey();
  if (!key) return heuristicAnalysis(input);

  const links = extractReceiptLinks(input.body);
  const bodyExcerpt = input.body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  const prompt = `You are a bookkeeping assistant. Decide if this email contains a business expense receipt or tax invoice (a document the user PAID for a product/service). Marketing/newsletters/order-status without a real receipt are NOT receipts.

Return STRICT JSON only, no markdown, with this shape:
{"is_receipt": boolean, "vendor": string|null, "total_amount": number|null, "vat_amount": number|null, "currency": string|null, "date": "YYYY-MM-DD"|null, "download_url": string|null}

- vendor: the merchant/company that issued the receipt.
- currency: ISO code like ILS, USD, EUR.
- date: the receipt/issue date if present.
- download_url: if the receipt itself is only reachable via a link (not attached), pick the most likely receipt/invoice download URL from the provided links, else null.

Email:
Subject: ${input.subject}
From: ${input.from}
Attachments: ${input.attachmentNames.join(", ") || "(none)"}
Candidate links: ${links.join(" | ") || "(none)"}
Body excerpt: ${bodyExcerpt}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    if (!res.ok) {
      return heuristicAnalysis(input);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    return {
      isReceipt: Boolean(parsed.is_receipt),
      vendor: typeof parsed.vendor === "string" && parsed.vendor.trim() ? parsed.vendor.trim() : parseSenderName(input.from),
      totalAmount: coerceNumber(parsed.total_amount),
      vatAmount: coerceNumber(parsed.vat_amount),
      currency: typeof parsed.currency === "string" ? parsed.currency.trim().toUpperCase().slice(0, 3) : null,
      date: coerceDate(parsed.date),
      downloadUrl:
        typeof parsed.download_url === "string" && /^https?:\/\//i.test(parsed.download_url)
          ? parsed.download_url
          : links[0] ?? null,
      source: "gemini",
    };
  } catch {
    return heuristicAnalysis(input);
  }
}
