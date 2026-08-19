// G411-15 — minimal service worker, installability baseline only.
//
// A PWA install prompt (Android/desktop Chrome) requires: a linked manifest
// + a *registered, controlling* service worker with at least a fetch
// handler. It does NOT require offline caching — that's a separate,
// heavier feature this task deliberately skips (Ponytail/YAGNI: build
// offline-first caching if/when the product actually needs offline
// support, not speculatively now).
//
// iOS Safari (16.4+) doesn't gate "Add to Home Screen" on a service worker
// at all, but Web Push on iOS *does* require the installed PWA to have one
// registered — this file is what G411-49 (push subscribe flow) will build
// on top of.

// ponytail: no-op fetch handler + no cache. Upgrade path: add a
// CacheStorage-based strategy (cache-first for static assets, network-first
// for API calls) if/when offline support becomes an actual requirement.
self.addEventListener('fetch', () => {
  // Intentionally does nothing — falls through to normal network fetch.
  // Presence of this handler is what makes the browser treat the app as
  // installable; behavior can be filled in later without touching the
  // registration code in main.jsx.
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
