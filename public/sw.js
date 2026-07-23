// Minimal, dependency-free service worker for the Command Center PWA.
// Navigations are network-first (always get the latest app when online, fall back
// to the cached shell offline). Hashed build assets are cache-first (fast repeat
// loads; safe because their filenames change on every deploy).
const CACHE = 'cc-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // App navigations: network-first, cache the latest shell, fall back offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then(r => r || caches.match('/index.html'))),
    )
    return
  }

  // Static assets: cache-first, populate the cache for hashed build output.
  event.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => {
        if (res.ok && url.pathname.startsWith('/assets/')) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
        }
        return res
      }),
    ),
  )
})
