// Kill-switch service worker: limpia cualquier SW/cache antiguo.
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((c) => {
            const url = new URL(c.url);
            url.searchParams.set("sw-cleanup", Date.now().toString());
            return c.navigate(url.toString());
          })
        );
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);
self.addEventListener("fetch", () => {});
