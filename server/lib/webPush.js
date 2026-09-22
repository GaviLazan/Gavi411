// Web Push delivery via VAPID protocol (browsers' native push infra).

import webpush from 'web-push'
import { prisma } from './prisma.js'

// VAPID setup deferred to first use — real misconfiguration surfaces loudly at first send.
let vapidConfigured = false
function ensureVapidConfigured() {
  if (vapidConfigured) return
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      'Web Push is misconfigured: VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must all be set (see .env.example). Push notifications cannot be sent until this is fixed.',
    )
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
}

// Sends payload to every subscription a user has. Stale subscriptions (410/404) are deleted.
// Logs notification to history before VAPID check (so history survives misconfiguration).
export async function sendPushToUser(userId, payload) {
  await prisma.notification.create({
    data: {
      userId,
      title: payload.title || '',
      body: payload.body || '',
      requestId: payload.requestId ?? null,
    },
  }).catch((err) => console.error(`Failed to log notification for user ${userId}:`, err.message))

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
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch((deleteErr) => console.error(`Failed to clean up stale subscription ${sub.id}:`, deleteErr.message))
        } else {
          console.error(`Push delivery failed for subscription ${sub.id}:`, err.message)
        }
      }
    }),
  )
}
