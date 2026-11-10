// Service worker: aplikasi tetap terbuka saat internet putus. Data (Supabase, /api) TIDAK pernah di-cache,
// jadi pesanan & pembayaran selalu butuh internet; yang dicache hanya cangkang aplikasi (HTML/JS/CSS/gambar/font).
const CACHE = 'pos-shell-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  if (sameOrigin && url.pathname.startsWith('/api/')) return

  // Navigasi: coba jaringan dulu, jatuh ke index.html tersimpan saat offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  const isStatic = sameOrigin && (url.pathname.startsWith('/assets/') || /\.(png|svg|jpg|webp|woff2?|webmanifest)$/.test(url.pathname))
  const isFont = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com'
  if (!isStatic && !isFont) return

  // stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      const net = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone())
        return res
      }).catch(() => hit)
      return hit || net
    }),
  )
})
