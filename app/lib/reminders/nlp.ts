import { addDays, fromIso, toIso } from "@/app/lib/reminders/dates";
import type { Recurrence } from "@/app/lib/reminders/types";

export type ParsedQuick = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: number;
  tags: string[];
  recurrence: Recurrence | null;
  /** Human labels of what was understood, for preview chips. */
  hints: string[];
};

const DAY_NAMES: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};
const DAY_RE = "(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)";
const B = "(?:^|\\s)";
const E = "(?=$|\\s|[,.!?])";

function nextWeekday(today: string, weekday: number) {
  const d = fromIso(today).getDay();
  const diff = (weekday - d + 7) % 7 || 7;
  return addDays(today, diff);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Understands short Hebrew phrases like "מחר ב-4 אחה״צ", "ביום שני בבוקר", "כל שבוע", "!!", "#בית". */
export function parseQuick(input: string, now = new Date()): ParsedQuick {
  let text = ` ${input} `;
  const today = toIso(now);
  const hints: string[] = [];
  let dueDate = null as string | null;
  let dueTime = null as string | null;
  let priority = 0;
  let recurrence = null as Recurrence | null;
  const tags: string[] = [];

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void | false) => {
    const m = text.match(re);
    if (!m || fn(m) === false) return false;
    text = text.replace(m[0], " ");
    return true;
  };
  const first = (...attempts: Array<() => boolean>) =>
    attempts.some((attempt) => attempt());

  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_, t: string) => {
    if (!tags.includes(t)) tags.push(t);
    return " ";
  });
  if (tags.length) hints.push(tags.map((t) => `#${t}`).join(" "));

  take(new RegExp(`${B}(!{1,3})${E}`), (m) => {
    priority = m[1].length;
    hints.push("!".repeat(priority));
  });

  // Recurrence
  first(
    () =>
      take(new RegExp(`${B}כל\\s+יום\\s+${DAY_RE}${E}`), (m) => {
        const wd = DAY_NAMES[m[1]];
        recurrence = { freq: "weekly", interval: 1, weekdays: [wd] };
        dueDate = nextWeekday(today, wd);
        if (fromIso(today).getDay() === wd) dueDate = today;
        hints.push(`כל יום ${m[1]}`);
      }),
    () =>
      take(new RegExp(`${B}כל\\s+(יום|שבוע|שבועיים|חודש|שנה)${E}`), (m) => {
        const map: Record<string, Recurrence> = {
          יום: { freq: "daily", interval: 1 },
          שבוע: { freq: "weekly", interval: 1 },
          שבועיים: { freq: "weekly", interval: 2 },
          חודש: { freq: "monthly", interval: 1 },
          שנה: { freq: "yearly", interval: 1 },
        };
        recurrence = map[m[1]];
        hints.push(`כל ${m[1]}`);
      }),
    () =>
      take(new RegExp(`${B}כל\\s+(\\d+)\\s+(ימים|שבועות|חודשים)${E}`), (m) => {
        const freq =
          m[2] === "ימים" ? "daily" : m[2] === "שבועות" ? "weekly" : "monthly";
        recurrence = { freq, interval: Number(m[1]) };
        hints.push(`כל ${m[1]} ${m[2]}`);
      }),
  );

  // Relative offsets that include a time
  take(
    new RegExp(
      `${B}בעוד\\s+(\\d+|שעה|שעתיים|חצי\\s+שעה)\\s*(דקות|דק׳|שעות)?${E}`,
    ),
    (m) => {
      let minutes: number;
      if (m[1] === "שעה") minutes = 60;
      else if (m[1] === "שעתיים") minutes = 120;
      else if (m[1].startsWith("חצי")) minutes = 30;
      else minutes = Number(m[1]) * (m[2] === "שעות" ? 60 : 1);
      if (!m[2] && /^\d+$/.test(m[1])) return false;
      const d = new Date(now.getTime() + minutes * 60_000);
      dueDate = toIso(d);
      dueTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      hints.push(`בעוד ${m[1]}${m[2] ? ` ${m[2]}` : ""}`);
    },
  );

  // Dates
  if (!dueDate) {
    first(
      () =>
        take(new RegExp(`${B}(היום|הערב|מחרתיים|מחר)${E}`), (m) => {
          dueDate =
            m[1] === "מחר"
              ? addDays(today, 1)
              : m[1] === "מחרתיים"
                ? addDays(today, 2)
                : today;
          if (m[1] === "הערב") dueTime = "19:00";
          hints.push(m[1]);
        }),
      () =>
        take(new RegExp(`${B}(?:ב)?יום\\s+${DAY_RE}(?:\\s+הבא)?${E}`), (m) => {
          dueDate = nextWeekday(today, DAY_NAMES[m[1]]);
          hints.push(`יום ${m[1]}`);
        }),
      () =>
        take(new RegExp(`${B}ב${DAY_RE}${E}`), (m) => {
          dueDate = nextWeekday(today, DAY_NAMES[m[1]]);
          hints.push(`יום ${m[1]}`);
        }),
      () =>
        take(new RegExp(`${B}(?:ב)?(שבוע|חודש)\\s+הבא${E}`), (m) => {
          dueDate =
            m[1] === "שבוע"
              ? addDays(today, 7)
              : toIso(
                  new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    now.getDate(),
                  ),
                );
          hints.push(`${m[1]} הבא`);
        }),
      () =>
        take(
          new RegExp(
            `${B}בעוד\\s+(\\d+|יומיים|שבוע|שבועיים|חודש)\\s*(ימים|שבועות|חודשים)?${E}`,
          ),
          (m) => {
            const n = Number(m[1]);
            let days = 0;
            if (m[1] === "יומיים") days = 2;
            else if (m[1] === "שבוע") days = 7;
            else if (m[1] === "שבועיים") days = 14;
            else if (m[1] === "חודש") days = 30;
            else
              days = n * (m[2] === "שבועות" ? 7 : m[2] === "חודשים" ? 30 : 1);
            dueDate = addDays(today, days);
            hints.push(`בעוד ${m[1]}${m[2] ? ` ${m[2]}` : ""}`);
          },
        ),
      () =>
        take(
          new RegExp(
            `${B}(?:ב-?|ב־)?(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?${E}`,
          ),
          (m) => {
            const day = Number(m[1]);
            const month = Number(m[2]);
            if (day < 1 || day > 31 || month < 1 || month > 12) return false;
            let year = m[3] ? Number(m[3]) : now.getFullYear();
            if (year < 100) year += 2000;
            let iso = `${year}-${pad(month)}-${pad(day)}`;
            if (!m[3] && iso < today)
              iso = `${year + 1}-${pad(month)}-${pad(day)}`;
            dueDate = iso;
            hints.push(`${day}.${month}`);
          },
        ),
    );
  }

  // Times
  if (!dueTime) {
    const part = '(בבוקר|בצהריים|אחה[״"]?צ|אחר\\s+הצהריים|בערב|בלילה)';
    first(
      () =>
        take(
          new RegExp(
            `${B}(?:בשעה\\s+|ב-?|ב־|ב\\s+(?=\\d{1,2}:))(\\d{1,2})(?::(\\d{2}))?(?:\\s+${part})?${E}`,
          ),
          (m) => {
            let h = Number(m[1]);
            const min = m[2] ? Number(m[2]) : 0;
            if (h > 23 || min > 59) return false;
            const p = m[3] ?? "";
            if (/צ|ערב|לילה/.test(p) && h < 12) h += 12;
            else if (!p && !m[2] && h >= 1 && h <= 6) h += 12;
            dueTime = `${pad(h)}:${pad(min)}`;
            hints.push(dueTime);
          },
        ),
      () =>
        take(
          new RegExp(`${B}(בבוקר|בצהריים|אחר\\s+הצהריים|בערב|בלילה)${E}`),
          (m) => {
            const map: Record<string, string> = {
              בבוקר: "09:00",
              בצהריים: "12:00",
              בערב: "19:00",
              בלילה: "21:00",
            };
            dueTime = map[m[1]] ?? "15:00";
            hints.push(m[1].replace(/^ב/, ""));
          },
        ),
    );
  }

  if (dueTime && !dueDate) {
    dueDate =
      dueTime < `${pad(now.getHours())}:${pad(now.getMinutes())}`
        ? addDays(today, 1)
        : today;
  }
  if (recurrence && !dueDate) dueDate = today;

  const title = text.replace(/\s+/g, " ").trim();
  return { title, dueDate, dueTime, priority, tags, recurrence, hints };
}
