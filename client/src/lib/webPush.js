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
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  })

  const json = subscription.toJSON()
  await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })

  return subscription
}

// Unsubscribes this browser and tells the server to forget it.
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await subscription.unsubscribe()
  await fetch('/api/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
}
