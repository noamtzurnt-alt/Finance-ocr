/*
 * Fast launch for the home-screen app.
 * - /chat, /notes: network first; the cached copy only when the network is slow or offline.
 * - /_next/static/*: content-hashed, cache-first so a cached /chat always has its chunks.
 * Everything else goes straight to the network.
 */
const SHELL_CACHE = "nf-shell-v8";
const SHELL_NETWORK_TIMEOUT_MS = 2500;
const STATIC_CACHE = "nf-static-v1";
const SHELLS = new Set(["/chat", "/notes"]);
const STATIC_MAX_ENTRIES = 400;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate" && SHELLS.has(url.pathname) && !url.search) {
    event.respondWith(shell(event, req, url.pathname));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    await cache.put(req, res.clone());
    void trim(cache);
  }
  return res;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - STATIC_MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

async function shell(event, req, path) {
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(req).then(async (res) => {
    const same = res.ok && res.type === "basic" && !res.redirected && new URL(res.url).pathname === path;
    if (same) await cache.put(path, res.clone());
    else if (res.type === "opaqueredirect" || res.redirected) await cache.delete(path);
    return res;
  });
  event.waitUntil(network.catch(() => null));

  const hit = await cache.match(path);
  if (!hit) return network;
  // The page carries the data, so a cached copy is shown only when the network is slow or offline.
  const slow = new Promise((resolve) => setTimeout(() => resolve(null), SHELL_NETWORK_TIMEOUT_MS));
  const fresh = await Promise.race([network.catch(() => null), slow]);
  return fresh || hit;
}

/* ── Reminder push notifications ─────────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "תזכורת", body: event.data ? event.data.text() : "" };
  }
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    dir: "rtl",
    lang: "he",
    requireInteraction: Boolean(data.reminderId),
    data: { url: data.url || "/reminders", reminderId: data.reminderId || null },
    actions: data.reminderId
      ? [
          { action: "complete", title: "בוצע ✓" },
          { action: "snooze", title: "עוד שעה" },
        ]
      : [],
  };
  event.waitUntil(self.registration.showNotification(data.title || "תזכורת", options));
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url, reminderId } = n.data || {};
  n.close();

  if (reminderId && (event.action === "complete" || event.action === "snooze")) {
    event.waitUntil(
      fetch("/api/push/action", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: reminderId, action: event.action }),
      }).catch(() => null),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const target = new URL(url || "/reminders", self.location.origin).href;
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(target).catch(() => null);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/api/push/subscribe", { credentials: "include" });
      if (!res.ok) return;
      const { publicKey } = await res.json();
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    })().catch(() => null),
  );
});

function urlB64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
