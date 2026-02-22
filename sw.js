/* Legacy SW retirement script.
 * Keep this file at /sw.js so already-installed clients can update to this
 * version, clear old caches, and unregister themselves.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    clients.forEach((client) => {
      try {
        const url = new URL(client.url);
        if (url.searchParams.has('cache-bust')) {
          url.searchParams.delete('cache-bust');
          client.navigate(url.toString());
        }
      } catch (_) {
        // Ignore invalid URL from non-window clients.
      }
    });

    await self.registration.unregister();
  })());
});
