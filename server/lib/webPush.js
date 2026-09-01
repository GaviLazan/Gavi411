// Web Push delivery (G411-29). Thin wrapper around the `web-push` package
// (VAPID protocol — no third-party push service, browsers' own push
// infra). Scope: infra + integration points only — the subscribe
// flow/permission UI is G411-49, which events actually trigger a push is
// G411-51. This file just answers "given a userId and a payload, deliver
// it to every browser that user subscribed from."

import webpush from 'web-push'
import { prisma } from './prisma.js'

// VAPID setup deferred to first use (not module load) — importing this
// file must never crash just because env vars aren't set yet (a fresh
// dev checkout, a test run that doesn't load .env). Real misconfiguration
// still surfaces loudly, just at the first actual send instead of import.
let vapidConfigured = false
function ensureVapidConfigured() {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  vapidConfigured = true
}

// Sends `payload` (plain object, JSON-serialized) to every subscription a
// user has registered (phone + desktop, etc.). A subscription that the
// push service reports as gone (410) or not-found (404) is stale — likely
// browser data cleared or permission revoked — and gets deleted so it
// stops being retried forever. Any other delivery failure (network blip,
// payload too large) is logged and skipped; one bad subscription must
// never block delivery to the user's other devices.
export async function sendPushToUser(userId, payload) {
  ensureVapidConfigured()
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  const body = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error(`Push delivery failed for subscription ${sub.id}:`, err.message)
        }
      }
    }),
  )
}
