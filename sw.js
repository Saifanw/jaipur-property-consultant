/* Tiny service worker: makes the site installable and keeps the app shell available offline.
   Firebase data is never cached here (always live). Bump VERSION when you change shared files. */
const VERSION = "jpc-v1";
const SHELL = ["assets/site.css","assets/config.js","assets/sprite.js","assets/app.js","manifest.json","assets/icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if(e.request.method !== "GET" || u.origin !== location.origin) return;
  if(/\/admin\.html$/.test(u.pathname)) return;                       // staff page: always live
  e.respondWith(fetch(e.request).then(r => { if(r.ok && (SHELL.some(p => u.pathname.endsWith(p)) || e.request.mode === "navigate")){ const c = r.clone(); caches.open(VERSION).then(ch => ch.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match("index.html"))));
});
