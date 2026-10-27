/* Racing Calendar iPhone / GitHub Pages: update-safe offline cache. */
const CACHE = 'race-calendar-github-pages-v64';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './v64.js', './v64.css', './vendor/supabase.js', './vendor/html2canvas.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('race-calendar-github-pages-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' || new URL(request.url).pathname.endsWith('/index.html');
  if (navigation) {
    // Always check the deployed page online, but keep last copy for offline access.
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html')) || Response.error()));
  } else {
    event.respondWith(caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      }).catch(() => Response.error());
      return cached || network;
    }));
  }
});
