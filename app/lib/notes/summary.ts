import { createHash } from "crypto";
import { notePlainPreview } from "@/app/lib/notes/html";

const SUMMARY_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const SHORT_NOTE_WORDS = 8;

export function noteSummaryHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex").slice(0, 24);
}

function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
}

/** A few-word Hebrew gist of the note. Short notes are shown as-is; returns "" when there is nothing to say. */
export async function summarizeNote(title: string, content: string): Promise<string> {
  const plain = notePlainPreview(content, 800);
  if (!plain) return "";
  if (plain.split(/\s+/).length <= SHORT_NOTE_WORDS) return plain;

  const key = geminiApiKey();
  const fallback = notePlainPreview(content, SHORT_NOTE_WORDS);
  if (!key) return fallback;

  const prompt = `סכם את הפתק הבא בעברית ב-3 עד 8 מילים, כמו שורת תקציר ברשימת פתקים, כך שיהיה ברור במבט אחד על מה הוא.
אל תחזור על הכותרת, בלי מירכאות, בלי נקודה בסוף, בלי הקדמה. החזר רק את התקציר.

כותרת: ${notePlainPreview(title, 40) || "(ללא)"}
תוכן:
${plain.slice(0, 4000)}`;

  for (const model of SUMMARY_MODELS) {
    try {
      const text = await generate(model, key, prompt);
      if (text) return text;
    } catch {
      // try the next model
    }
  }
  return fallback;
}

async function generate(model: string, key: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return "";
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .replace(/["״“”]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/, "")
    .trim()
    .slice(0, 90);
}
