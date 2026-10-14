// Wechat web-push service worker.
// Receives push events from the server and shows native OS notifications.
// Clicking a notification focuses the app and navigates to the relevant URL.

// ponytail: keep all logic in one file — no bundler step needed in /public.

self.addEventListener("install", (event) => {
  // Activate immediately on first install so the page can subscribe without reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Wechat", body: "", href: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const notif = new Notification(payload.title, {
    body: payload.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { href: payload.href || "/" },
    tag: payload.tag || undefined,
  });

  event.waitUntil(notif);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus an existing tab if there is one
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(href);
          return;
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) await self.clients.openWindow(href);
    })(),
  );
});