import webpush from "web-push";
import { prisma } from "@/app/lib/prisma";
import { EARLY_OPTIONS } from "@/app/lib/reminders/types";

export const DEFAULT_TZ = "Asia/Jerusalem";
/** All-day reminders alert at this local time, like Apple Reminders. */
const ALL_DAY_TIME = "09:00";
/** Alerts missed by a late/failed cron run are still sent within this window. */
const CATCH_UP_MS = 20 * 60 * 1000;

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  reminderId?: string;
};

let configured = false;
export function pushConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://finance-ocr-tan.vercel.app", pub, priv);
  configured = true;
  return true;
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Local wall-clock date/time in `tz` at instant `ms`. */
export function localNow(tz: string, ms = Date.now()) {
  return zonedParts(ms, tz);
}

/** UTC instant of local `date time` in `tz` (DST-safe). */
export function localToUtc(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, tz);
    const [py, pm, pd] = p.date.split("-").map(Number);
    const [ph, pmi] = p.time.split(":").map(Number);
    guess += naive - Date.UTC(py, pm - 1, pd, ph, pmi);
  }
  return guess;
}

export async function sendToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, failed: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high", topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) },
        );
        sent += 1;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
        } else {
          console.error("[push] send failed", status, (err as Error).message);
        }
      }
    }),
  );
  return { sent, failed };
}

function earlyLabel(minutes: number) {
  return EARLY_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} דקות לפני`;
}

/**
 * Sends every on-time and early alert that became due since the last run.
 * Each alert is claimed atomically (notifiedKey) before sending, so overlapping
 * runs never double-notify; editing the date/time re-arms it.
 */
export async function runReminderPush(nowMs = Date.now()) {
  if (!pushConfigured()) return { error: "VAPID keys missing" };

  const subs = await prisma.pushSubscription.findMany({
    select: { userId: true, timeZone: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "desc" },
  });
  const tzByUser = new Map<string, string>();
  for (const s of subs) if (!tzByUser.has(s.userId)) tzByUser.set(s.userId, s.timeZone || DEFAULT_TZ);
  if (!tzByUser.size) return { users: 0, sent: 0 };

  const day = 24 * 60 * 60 * 1000;
  const from = new Date(nowMs - 2 * day).toISOString().slice(0, 10);
  const to = new Date(nowMs + 2 * day).toISOString().slice(0, 10);

  const candidates = await prisma.reminder.findMany({
    where: {
      userId: { in: [...tzByUser.keys()] },
      completed: false,
      deletedAt: null,
      dueDate: { gte: from, lte: to },
    },
    include: { list: { select: { name: true } } },
  });

  let sent = 0;
  for (const r of candidates) {
    const tz = tzByUser.get(r.userId) ?? DEFAULT_TZ;
    const at = localToUtc(r.dueDate!, r.dueTime ?? ALL_DAY_TIME, tz);
    const key = `${r.dueDate} ${r.dueTime ?? ""}`;
    // Ignore times that were already in the past when the reminder was last edited.
    const armed = r.updatedAt.getTime() <= at + 60_000;
    const url = `/reminders?r=${r.id}`;

    if (armed && at <= nowMs && at > nowMs - CATCH_UP_MS && r.notifiedKey !== key) {
      const claim = await prisma.reminder.updateMany({
        where: { id: r.id, OR: [{ notifiedKey: null }, { notifiedKey: { not: key } }] },
        data: { notifiedKey: key },
      });
      if (claim.count) {
        const when = r.dueTime ? `${r.dueTime} · ` : "";
        const res = await sendToUser(r.userId, {
          title: r.title || "תזכורת",
          body: `${when}${r.list.name}${r.notes.trim() ? `\n${r.notes.trim().split("\n")[0]}` : ""}`,
          tag: r.id,
          url,
          reminderId: r.id,
        });
        sent += res.sent;
      }
      continue;
    }

    if (r.dueTime && r.earlyMinutes && r.earlyMinutes > 0) {
      const earlyAt = at - r.earlyMinutes * 60_000;
      const earlyArmed = r.updatedAt.getTime() <= earlyAt + 60_000;
      if (earlyArmed && earlyAt <= nowMs && earlyAt > nowMs - CATCH_UP_MS && at > nowMs && r.earlyNotifiedKey !== key) {
        const claim = await prisma.reminder.updateMany({
          where: { id: r.id, OR: [{ earlyNotifiedKey: null }, { earlyNotifiedKey: { not: key } }] },
          data: { earlyNotifiedKey: key },
        });
        if (claim.count) {
          const res = await sendToUser(r.userId, {
            title: r.title || "תזכורת",
            body: `${earlyLabel(r.earlyMinutes)} · ${r.dueTime} · ${r.list.name}`,
            tag: r.id,
            url,
            reminderId: r.id,
          });
          sent += res.sent;
        }
      }
    }
  }
  return { users: tzByUser.size, candidates: candidates.length, sent };
}
