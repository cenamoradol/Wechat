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
    console.log("[push] received", payload);
  } catch (e) {
    console.error("[push] parse failed", e);
    if (event.data) payload.body = event.data.text();
  }

  // Use registration.showNotification (returns a Promise) so event.waitUntil
  // properly keeps the SW alive until the notification is shown.
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { href: payload.href || "/" },
      tag: payload.tag || undefined,
      requireInteraction: false,
    }),
  );
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