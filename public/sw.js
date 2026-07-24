// Minimal, dependency-free service worker for the Command Center PWA.
//
// Design goal: NEVER be able to show a blank page. The HTML document is always
// fetched from the network (never served from a pinned cache), so the app can't
// get stuck on a stale index that points at build assets which no longer exist.
// Only hashed build assets and static icons are cached (safe — their filenames
// change every deploy). Bump CACHE to invalidate everything on the next visit.
const CACHE = 'cc-assets-v2'

self.addEventListener('install', event => {
  // Activate immediately; nothing is precached so there's no stale document.
  event.waitUntil(self.skipWaiting())
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

  // The app document / navigations: always network. No cache fallback, so a bad
  // or outdated cache can never blank the app. (Offline simply fails to load,
  // same as any un-cached site — acceptable and safe.)
  if (req.mode === 'navigate' || req.destination === 'document') return

  // Hashed build assets + icons: cache-first for fast repeat loads.
  const cacheable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon-')
  if (!cacheable) return
  event.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
        }
        return res
      }),
    ),
  )
})
