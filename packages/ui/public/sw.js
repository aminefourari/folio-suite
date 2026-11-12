// Offline support, registered by the desktop app (apps/desktop/preload.cjs), not in browsers: it keeps account
// files on disk, which is fine on your own computer but not on a shared one.
// Network first, so online is always fresh; when the network fails, the last copy of anything opened before:
// pages, assets, Google Fonts and server-function reads (the file list, a file). Writes (POST) are never cached;
// unsent edits wait in localStorage instead (keepUnsynced in packages/ui/src/local.ts).
const CACHE = 'folio-v1'
const FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Offline</title><body style="font:15px system-ui,sans-serif;display:grid;place-items:center;height:90vh;text-align:center;color-scheme:light dark">
<div><h1 style="font-size:20px">You’re offline</h1><p>This page hasn’t been opened on this device yet.</p>
<p><a href="javascript:history.back()">Go back</a> · <a href="javascript:location.reload()">Try again</a></p></div>`

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.pathname.startsWith('/api/auth/')) return
  if (url.origin !== location.origin && !FONTS.includes(url.hostname)) return
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await fetch(req)
      if (res.ok) await cache.put(req, res.clone())
      return res
    } catch (err) {
      const hit = await cache.match(req, { ignoreVary: true })
      if (hit) return hit
      if (req.mode === 'navigate') return new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      throw err
    }
  })())
})
