import JSZip from "jszip";

export type ParsedStatementRow = {
  date: string; // YYYY-MM-DD
  amount: string;
  vendor: string;
  description: string | null;
  raw?: Record<string, string>;
};

type ColumnMap = {
  date: number | null;
  amount: number | null;
  vendor: number | null;
  description: number | null;
};

function normalizeHeader(h: string) {
  return h
    .replace(/\u200f|\u200e|\ufeff/g, "")
    .replace(/["״"'′]/g, "") // בש"ח → בשח
    .trim()
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Prefer earlier patterns; scan all headers per pattern (CAL: סכום חיוב before סכום עסקה). */
function pickColumn(headers: string[], patterns: RegExp[]): number | null {
  for (const p of patterns) {
    for (let i = 0; i < headers.length; i++) {
      const h = normalizeHeader(headers[i] ?? "");
      if (h && p.test(h)) return i;
    }
  }
  return null;
}

function mapColumns(headers: string[]): ColumnMap {
  return {
    date: pickColumn(headers, [
      /^תאריך עסקה$/,
      /^תאריך חיוב$/,
      /^מועד חיוב$/,
      /^תאריך$/,
      /תאריך.*(עסקה|חיוב)/,
      /מועד.*חיוב/,
      /^date$/,
      /transaction\s*date/,
      /purchase\s*date/,
    ]),
    amount: pickColumn(headers, [
      /^סכום חיוב$/,
      /^סכום עסקה$/,
      /^סכום בשח$/, // "סכום בש\"ח" after quote strip
      /^סכום בשקלים$/,
      /^סכום$/,
      /סכום.*(חיוב|עסקה|לשקל|בשח|שקל)/,
      /^amount$/,
      /billing\s*amount/,
      /charge\s*amount/,
    ]),
    vendor: pickColumn(headers, [
      /^שם בית עסק$/,
      /^בית עסק$/,
      /^שם בית העסק$/,
      /^שם העסק$/,
      /^בית העסק$/,
      /שם.*(עסק|ספק)/,
      /^vendor$/,
      /^merchant$/,
      /merchant\s*name/,
    ]),
    description: pickColumn(headers, [
      /^הערות$/,
      /^פירוט$/,
      /^תיאור$/,
      /^פרטים$/,
      /^notes$/,
      /^description$/,
      /סוג עסקה/,
    ]),
  };
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellToString((value as { result?: unknown }).result);
  }
  return String(value).trim();
}

function parseAmount(raw: string): number | null {
  let s = raw.replace(/[₪$€,\s]/g, "").replace(/‏/g, "");
  // Israeli format sometimes uses 1.234,56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  // ignore credit/refund markers by taking absolute value of signed amounts
  s = s.replace(/^[+(]/, (m) => (m === "(" ? "-" : ""));
  s = s.replace(/\)$/, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n);
}

function formatLocalYmd(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  // Excel serial date (1900 system) — interpret as local calendar day
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDate(raw: string | unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return formatLocalYmd(raw);
  }
  const s = cellToString(raw);
  if (!s) return null;

  const asNum = Number(s);
  if (Number.isFinite(asNum) && !s.includes("/") && !s.includes("-") && !s.includes(".")) {
    const fromSerial = excelSerialToDate(asNum);
    if (fromSerial) return formatLocalYmd(fromSerial);
  }

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (!Number.isNaN(dt.getTime())) return formatLocalYmd(dt);
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const mo = Number(m[2]);
    const d = Number(m[1]);
    const dt = new Date(y, mo - 1, d);
    if (!Number.isNaN(dt.getTime())) return formatLocalYmd(dt);
  }

  return null;
}

function parseMatrix(matrix: string[][]): ParsedStatementRow[] {
  if (matrix.length < 2) return [];

  // Find header row within first 15 rows (CAL sometimes puts title lines above)
  let headerIdx = -1;
  let cols: ColumnMap | null = null;
  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const headers = matrix[i] ?? [];
    const mapped = mapColumns(headers);
    if (mapped.date != null && mapped.amount != null && mapped.vendor != null) {
      headerIdx = i;
      cols = mapped;
      break;
    }
  }
  if (headerIdx < 0 || !cols || cols.date == null || cols.amount == null || cols.vendor == null) {
    throw new Error(
      "לא זיהינו עמודות בקובץ. ודא שיש עמודות לתאריך, סכום ובית עסק (כמו בייצוא מאתר כאל).",
    );
  }

  const headers = matrix[headerIdx] ?? [];
  const out: ParsedStatementRow[] = [];
  const seen = new Set<string>();

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (row.every((c) => !String(c ?? "").trim())) continue;

    const date = parseDate(row[cols.date]);
    const amountNum = parseAmount(cellToString(row[cols.amount]));
    const vendor = cellToString(row[cols.vendor]).slice(0, 120);
    if (!date || amountNum == null || !vendor) continue;

    // skip summary / total rows
    if (/סה.?כ|total|סיכום/i.test(vendor)) continue;

    const description =
      cols.description != null ? cellToString(row[cols.description]).slice(0, 500) || null : null;
    const amount = amountNum.toFixed(2);
    const key = `${date}|${amount}|${vendor.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h?.trim()) raw[h.trim()] = cellToString(row[i]);
    });

    out.push({ date, amount, vendor, description, raw });
  }

  return out;
}

function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  // Prefer delimiter by first line
  const firstLine = cleaned.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const delim =
    (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
      ? ";"
      : (firstLine.match(/\t/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
        ? "\t"
        : ",";

  const lines = cleaned.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) {
      rows.push([]);
      continue;
    }
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Banks sometimes export "Excel" as HTML table with .xls/.xlsx extension. */
function parseHtmlTable(html: string): string[][] {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  let best: string[][] = [];
  for (const m of tables) {
    const table = m[0]!;
    const rows: string[][] = [];
    for (const tr of table.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells: string[] = [];
      for (const td of tr[0]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
        cells.push(decodeHtmlEntities(td[1] ?? ""));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length > best.length) best = rows;
  }
  return best;
}

function looksLikeZip(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function looksLikeHtml(buffer: Buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.includes("<table");
}

function looksLikeCsvText(buffer: Buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 800)).toString("utf8");
  if (head.includes("\u0000")) return false;
  return /תאריך|בית עסק|סכום|date|merchant|amount/i.test(head);
}

function colLettersToIndex(letters: string) {
  let n = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return Math.max(0, n - 1);
}

function stripXmlNs(xml: string) {
  // CAL uses prefixed elements like <x:workbook>, <x:c> — strip prefixes/default xmlns for regex parse
  return xml
    .replace(/xmlns(:\w+)?="[^"]*"/g, "")
    .replace(/<\/?[a-zA-Z0-9]+:/g, (m) => m.replace(/[a-zA-Z0-9]+:/, ""));
}

function parseSharedStrings(xml: string): string[] {
  const clean = stripXmlNs(xml);
  const out: string[] = [];
  for (const si of clean.matchAll(/<si\b[\s\S]*?<\/si>/gi)) {
    const texts: string[] = [];
    for (const t of si[0]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)) {
      texts.push(
        (t[1] ?? "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'"),
      );
    }
    out.push(texts.join(""));
  }
  return out;
}

function parseSheetRows(sheetXml: string, shared: string[]): string[][] {
  const clean = stripXmlNs(sheetXml);
  const matrix: string[][] = [];

  for (const rowMatch of clean.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const rowXml = rowMatch[1] ?? "";
    const byCol = new Map<number, string>();
    let maxCol = -1;

    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi)) {
      const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
      const inner = cellMatch[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/i)?.[1];
      if (!ref) continue;
      const colIdx = colLettersToIndex(ref);
      maxCol = Math.max(maxCol, colIdx);

      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
      const isMatch = inner.match(/<is\b[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>/i);
      let raw = vMatch?.[1] ?? isMatch?.[1] ?? "";
      raw = raw.trim();

      let value = "";
      if (type === "s" && raw !== "") {
        const idx = Number(raw);
        value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        value = isMatch?.[1] ?? raw;
      } else {
        value = raw;
      }
      byCol.set(colIdx, value);
    }

    if (maxCol < 0) {
      matrix.push([]);
      continue;
    }
    const row: string[] = [];
    for (let i = 0; i <= maxCol; i++) row.push(byCol.get(i) ?? "");
    matrix.push(row);
  }

  return matrix;
}

/** Native OOXML reader — works with CAL's namespaced x:workbook / x:sheet XML. */
async function parseXlsxOoxml(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetFiles = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (sheetFiles.length === 0) {
    throw new Error("לא נמצאו גיליונות בקובץ ה-Excel");
  }

  const ssFile = zip.file("xl/sharedStrings.xml");
  const shared = ssFile ? parseSharedStrings(await ssFile.async("string")) : [];

  let best: string[][] = [];
  let bestScore = -1;

  for (const path of sheetFiles) {
    const xml = await zip.file(path)!.async("string");
    const matrix = parseSheetRows(xml, shared);
    try {
      const parsed = parseMatrix(matrix);
      if (parsed.length > bestScore) {
        bestScore = parsed.length;
        best = matrix;
      }
    } catch {
      if (bestScore < 0 && matrix.length > best.length) best = matrix;
    }
  }

  if (best.length === 0) throw new Error("הקובץ ריק או שלא נמצאו גיליונות");
  return best;
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  try {
    return await parseXlsxOoxml(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sheets|zip|corrupt|invalid|central directory/i.test(msg) && !msg.includes("לא נמצאו") && !msg.includes("ריק")) {
      throw new Error("לא הצלחנו לקרוא את קובץ ה-Excel מכאל. נסה שוב, או הורד מחדש מהאפליקציה.");
    }
    throw e;
  }
}

function matrixFromBuffer(buffer: Buffer, fileName: string, mimeType?: string): Promise<string[][]> | string[][] {
  const name = fileName.toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (looksLikeHtml(buffer)) {
    const matrix = parseHtmlTable(buffer.toString("utf8"));
    if (matrix.length === 0) throw new Error("נמצא HTML בקובץ אבל בלי טבלת תנועות");
    return matrix;
  }

  if (
    name.endsWith(".csv") ||
    name.endsWith(".tsv") ||
    mime.includes("csv") ||
    mime.includes("text/plain") ||
    (!looksLikeZip(buffer) && looksLikeCsvText(buffer))
  ) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (name.endsWith(".xls") && !looksLikeZip(buffer)) {
    // Old binary .xls or HTML-as-xls
    if (looksLikeCsvText(buffer)) return parseCsv(buffer.toString("utf8"));
    throw new Error("קובץ .xls ישן לא נתמך — בכאל שמור/ייצא כ-CSV או Excel (.xlsx)");
  }

  if (looksLikeZip(buffer) || name.endsWith(".xlsx") || name.endsWith(".xlsm") || mime.includes("spreadsheet")) {
    return parseXlsx(buffer);
  }

  // Last resorts
  if (looksLikeCsvText(buffer)) return parseCsv(buffer.toString("utf8"));
  throw new Error("פורמט קובץ לא מזוהה — נסה CSV או Excel (.xlsx) מכאל");
}

export async function parseStatementFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<ParsedStatementRow[]> {
  const name = params.fileName.toLowerCase();
  const mime = (params.mimeType ?? "").toLowerCase();

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    throw new Error("קובץ PDF לא נתמך כרגע — הורד מאפליקציית כאל ייצוא ל-Excel או CSV");
  }

  if (!params.buffer.length) {
    throw new Error("הקובץ ריק");
  }

  let matrix: string[][];
  try {
    const result = matrixFromBuffer(params.buffer, params.fileName, params.mimeType);
    matrix = result instanceof Promise ? await result : result;
  } catch (e) {
    // If xlsx failed but content looks like text/csv — retry
    if (looksLikeCsvText(params.buffer)) {
      matrix = parseCsv(params.buffer.toString("utf8"));
    } else if (looksLikeHtml(params.buffer)) {
      matrix = parseHtmlTable(params.buffer.toString("utf8"));
    } else {
      throw e;
    }
  }

  const rows = parseMatrix(matrix);
  if (rows.length === 0) {
    throw new Error("לא נמצאו תנועות בקובץ. בדוק שמורידים את דוח התנועות מכאל בפורמט Excel/CSV.");
  }
  return rows;
}
