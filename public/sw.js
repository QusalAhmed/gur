/* eslint-disable no-restricted-globals */
// Gur Admin Lite PWA Service Worker
// - Zero caching of authenticated admin pages or API responses (preserves no-store & PII safety)
// - Minimal offline fallback screen when network navigation fails
// - Web Push notifications with foreground suppression, App Icon Badge sync, and deep-link focus

const OFFLINE_CACHE = "gur-admin-offline-v1";
const OFFLINE_URL = "/admin-offline.html";
const OFFLINE_ASSETS = [
  OFFLINE_URL,
  "/icons/admin-icon-192.png",
  "/icons/admin-badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-only fetch: only provide the static offline page if a document navigation fails offline
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Serve cached static icon on offline page if offline
  const url = new URL(request.url);
  if (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      if (cached) return cached;
      return new Response("Offline — please reconnect and retry.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
  );
});

function normalizeAdminUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return self.location.hostname.startsWith("admin.") ? "/" : "/admin";
  }

  // External link (e.g. Facebook comment URL)
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const isAdminSubdomain =
    self.location.hostname === "admin.khatikhejurgur.shop" ||
    self.location.hostname.startsWith("admin.");

  if (isAdminSubdomain) {
    if (cleanPath === "/admin") return "/";
    if (cleanPath.startsWith("/admin/")) return cleanPath.slice("/admin".length) || "/";
    if (cleanPath.startsWith("/admin?")) return `/${cleanPath.slice("/admin".length)}`;
    return cleanPath;
  }

  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/") || cleanPath.startsWith("/admin?")) {
    return cleanPath;
  }
  return cleanPath === "/" ? "/admin" : `/admin${cleanPath}`;
}

async function updateAppBadge(count) {
  try {
    if (typeof count !== "number" || !Number.isFinite(count)) return;
    if (count > 0 && typeof self.navigator?.setAppBadge === "function") {
      await self.navigator.setAppBadge(Math.min(999, Math.floor(count)));
    } else if (count <= 0 && typeof self.navigator?.clearAppBadge === "function") {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // Badge API not supported or permission restricted
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Gramayon",
      body: event.data.text() || "New admin notification",
    };
  }

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : "Gramayon";
  const body = typeof payload.body === "string" ? payload.body : "";
  const icon = payload.icon || "/admin-icon/icon-192.png";
  const badge = payload.badge || "/icons/admin-badge-96.png";
  const tag = payload.tag || (payload.notificationId ? `gur-notif-${payload.notificationId}` : "gur-admin-notif");
  const targetUrl = normalizeAdminUrl(payload.url);
  const forceShow = payload.forceShow === true;

  event.waitUntil(
    (async () => {
      if (typeof payload.unreadCount === "number") {
        await updateAppBadge(payload.unreadCount);
      }

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const hasFocusedClient = windowClients.some(
        (client) => client.focused && client.visibilityState === "visible"
      );

      // Notify any open admin tabs so React Query refreshes immediately
      for (const client of windowClients) {
        try {
          client.postMessage({
            type: "GUR_PUSH_RECEIVED",
            payload: {
              notificationId: payload.notificationId || null,
              unreadCount: payload.unreadCount,
            },
          });
        } catch {
          // Ignore postMessage failure on closing tab
        }
      }

      // Suppress OS push banner when an admin tab is actively focused (unless explicit test push)
      if (hasFocusedClient && !forceShow) {
        return;
      }

      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        renotify: true,
        vibrate: [120, 60, 120],
        data: {
          url: targetUrl,
          notificationId: payload.notificationId || null,
          orderNumber: payload.orderNumber || null,
          orderId: payload.orderId || null,
        },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = normalizeAdminUrl(data.url);
  const isExternal = /^https?:\/\//i.test(targetUrl);

  event.waitUntil(
    (async () => {
      if (isExternal) {
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
        return;
      }

      const fullTargetUrl = new URL(targetUrl, self.location.origin).href;
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          try {
            client.postMessage({
              type: "GUR_NOTIFICATION_CLICK",
              url: targetUrl,
              orderNumber: data.orderNumber || null,
              orderId: data.orderId || null,
            });
          } catch {
            // Ignore postMessage error
          }
          if ("navigate" in client && client.url !== fullTargetUrl) {
            try {
              await client.navigate(fullTargetUrl);
            } catch {
              // SPA client will still navigate via GUR_NOTIFICATION_CLICK message
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(fullTargetUrl);
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (msg.type === "UPDATE_BADGE") {
    event.waitUntil(updateAppBadge(msg.count));
  }
});
