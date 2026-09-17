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

// G411-29: display an incoming Web Push message. `sendPushToUser` (server/
// lib/webPush.js) sends { title, body } JSON — matches what
// notifyAdminOfDeviceRequest sends today. showNotification is required
// here (a push event without one gets the browser to show its own generic
// "this site was updated" notification instead, on Chrome).
//
// Sibling review finding: event.data.json() used to throw unhandled on a
// malformed/non-JSON payload — since that throw happened before
// showNotification ran, it produced exactly the generic-fallback
// notification this code exists to avoid. Guarded so a bad payload still
// shows *something* instead of silently failing.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Malformed payload — fall through to the default title/body below
    // rather than let showNotification never get called.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gavi411', {
      body: data.body || '',
      data: { requestId: data.requestId ?? null },
    }),
  )
  // Tell any open tab a push arrived, so a list already on-screen (e.g.
  // an admin viewing Open requests when a friend's new request notifies
  // them) can refetch instead of silently going stale until a manual
  // reload. BroadcastChannel reaches every open tab/window at once,
  // unlike postMessage to a single client.
  new BroadcastChannel('gavi411-push').postMessage({ type: 'push' })
})

// G411-102: handle notification clicks to deep-link into the specific request
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requestId = event.notification.data?.requestId
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // Firefox: focus() can throw InvalidAccessError when the window
          // lacks transient activation (i.e. isn't already the OS-focused
          // window) — a real, spec-level browser limitation, not
          // something this code can force. Caught separately so a focus
          // failure doesn't also block postMessage below — the app can
          // still navigate to the right request even if the OS/WM won't
          // visually raise the window for us.
          try {
            client.focus()
          } catch {
            // Focus failed (likely Firefox's transient-activation
            // requirement) — fall through and still try to message the
            // client below.
          }
          if (requestId != null) client.postMessage({ type: 'notification-click', requestId })
          return
        }
      }
      // No open client — open one. Cold-start case falls back to normal
      // landing screen; the postMessage path above handles the
      // already-running app case fully.
      if (self.clients.openWindow) {
        return self.clients.openWindow('/')
      }
    }),
  )
})
