/* Service worker: makes the site installable (Chrome needs a fetch handler) and keeps the app shell offline.
   Firebase / admin / CRM pages are never cached. Bump VERSION when you change shared files. */
const VERSION = "jpc-v7";
const SHELL = ["/", "/assets/site.css", "/assets/config.js", "/assets/sprite.js", "/assets/i18n.js", "/assets/app.js", "/assets/match.js", "/assets/pwa.js", "/manifest.json", "/assets/icons/icon-192.png"];
const PRIVATE = /^\/(admin|crm-smart|visitor-analytics|property-os|properties-crm|crm-demo)(\.html)?\/?$/;

self.addEventListener("install", e => {
  // one missing file must never stop the worker from installing -> add each file on its own
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || PRIVATE.test(u.pathname)) return;
  const nav = req.mode === "navigate";
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok && (nav || SHELL.includes(u.pathname))) { const c = r.clone(); caches.open(VERSION).then(ch => ch.put(req, c)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(req).then(m => m || (nav ? caches.match("/") : undefined)).then(m => m || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })))
  );
});
