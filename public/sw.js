// Minimal, dependency-free service worker for the Command Center PWA.
//
// Design goal: NEVER be able to show a blank page. The HTML document is always
// fetched from the network (never served from a pinned cache), so the app can't
// get stuck on a stale index that points at build assets which no longer exist.
// Only hashed build assets and static icons are cached (safe — their filenames
// change every deploy). Bump CACHE to invalidate everything on the next visit.
// Bumped to v3 to evict icons pinned by the old cache-first rule below.
const CACHE = 'cc-assets-v3'

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

  // Icons and the manifest keep the SAME filename across deploys, so cache-first
  // would pin an old icon forever — replacing icon-192.png would never reach an
  // installed app. Serve from cache for speed/offline, but always refetch in the
  // background so a replaced icon shows up on the next launch.
  if (url.pathname.startsWith('/icon-') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(req)
        const fresh = fetch(req)
          .then(res => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || fresh
      }),
    )
    return
  }

  // Hashed build assets: cache-first is safe here — Vite gives these a content
  // hash, so a changed file arrives under a new name.
  if (!url.pathname.startsWith('/assets/')) return
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
