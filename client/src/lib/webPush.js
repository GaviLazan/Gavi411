// Web Push subscribe/unsubscribe: browser subscription → server registration.

// PushManager.subscribe needs applicationServerKey as a Uint8Array, not
// the base64url string the VAPID keygen prints — this is the standard
// conversion (MDN's own example), not a custom crypto routine.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

// Subscribe to push: validates VAPID key upfront, rolls back if server POST fails.
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
