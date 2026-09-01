// Web Push subscribe/unsubscribe (G411-29 infra). The permission-request
// UI/prompt itself is G411-49's job — this file is the plumbing that UI
// will call: ask the browser to subscribe, hand the subscription to the
// server, done.

// PushManager.subscribe needs applicationServerKey as a Uint8Array, not
// the base64url string the VAPID keygen prints — this is the standard
// conversion (MDN's own example), not a custom crypto routine.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

// Subscribes this browser to push and registers it with the server. Call
// after the user has granted Notification permission (G411-49's job) and
// after the service worker is registered (G411-15, main.jsx). Cookie-based
// Clerk session, same as every other fetch in this app — no manual
// Authorization header needed. Returns the subscription, or null if push
// isn't supported here (older browser, iOS without an installed PWA).
//
// Sibling review findings, both fixed: (1) a missing VITE_VAPID_PUBLIC_KEY
// used to throw an opaque TypeError deep inside base64 decoding — checked
// up front with a clear message instead. (2) if the browser subscribes
// successfully but the POST to the server fails, the browser was left
// "subscribed" with no server-side record — rolled back via
// subscription.unsubscribe() so the two stay in sync instead of silently
// desyncing.
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set — see client/.env.example')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  const json = subscription.toJSON()
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })

  if (!res.ok) {
    await subscription.unsubscribe()
    throw new Error(`Failed to register push subscription with the server (${res.status})`)
  }

  return subscription
}

// Unsubscribes this browser and tells the server to forget it.
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await subscription.unsubscribe()
  const res = await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  if (!res.ok) {
    throw new Error(`Failed to remove push subscription from the server (${res.status})`)
  }
}
