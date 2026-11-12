/* Service Worker: עבודה בלי רשת למסכי האתר, וקבלת קבצים מתפריט השיתוף של אנדרואיד. */
'use strict';
importScripts('./store.js');

const VERSION = '1.0.0';
const CACHE = 'call-summary-' + VERSION;
const ASSETS = ['./', './index.html', './app.js', './store.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('call-summary-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Gemini ושאר הבקשות החיצוניות עוברות ישירות
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET') return;
  // קודם רשת (כדי לקבל עדכונים), ואם אין רשת – מהמטמון
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});

async function receiveShare(request) {
  const ids = [];
  try {
    const form = await request.formData();
    const files = form.getAll('audio').filter((f) => f && typeof f === 'object' && f.size > 0);
    for (const f of files) {
      const id = csNewId('in-');
      await csStore.put('inbox', {
        id,
        name: f.name || 'recording',
        type: f.type || '',
        size: f.size,
        lastModified: f.lastModified || Date.now(),
        blob: f,
        receivedAt: new Date().toISOString(),
        via: 'share',
        status: 'new',
      });
      ids.push(id);
    }
  } catch (e) {
    return Response.redirect(new URL('./?shareError=1', self.registration.scope).href, 303);
  }
  const target = ids.length ? './?shared=' + encodeURIComponent(ids.join(',')) : './?shareError=empty';
  return Response.redirect(new URL(target, self.registration.scope).href, 303);
}
