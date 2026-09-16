// G411-51: Notification dispatch helpers for push notifications across
// the request lifecycle. Centralizes admin/user lookup and suppresses
// self-notification (actor doesn't get notified of their own action).
// Web Push is the primary channel for everyone (friends and admin);
// Telegram is a secondary Gavi-only channel, deprioritized behind Web Push
// (G411-45/#93). Real Telegram wiring lives in G411-50; this file is just
// the stub/integration point.

import { prisma } from './prisma.js'
import { sendPushToUser } from './webPush.js'

// Stub for G411-50 to wire in real Telegram bot send. Currently a no-op.
// ponytail: stub until G411-50 wires the real Telegram bot send
function sendTelegram(payload) {
  // TODO: G411-50 implements real Telegram API call here
  // For now: no-op, placeholder for later integration
}

// Notifies all admin users of an event via push notifications (and
// optionally Telegram). Looks up all users with role: ADMIN, calls
// sendPushToUser for each, and if telegram option is true, calls
// sendTelegram. Suppresses self-notification: if excludeClerkId matches
// an admin's clerkId, that admin is skipped.
//
// payload: object with { title, body } (plain text, ready for UI display)
// options: { telegram: boolean, excludeClerkId: string }
export async function notifyAdmins(payload, { telegram = false, excludeClerkId = null } = {}) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })

  await Promise.all(
    admins
      .filter((admin) => admin.clerkId !== excludeClerkId)
      .map((admin) => sendPushToUser(admin.clerkId, payload)),
  )

  if (telegram) {
    sendTelegram(payload)
  }
}

// Notifies a specific user via push notification (and optionally Telegram).
// Calls sendPushToUser directly for the given clerkId, and if telegram
// option is true, calls sendTelegram. Suppresses self-notification: if
// excludeClerkId matches the target clerkId, no notification is sent.
//
// clerkId: the user to notify
// payload: object with { title, body }
// options: { telegram: boolean, excludeClerkId: string }
export async function notifyUser(clerkId, payload, { telegram = false, excludeClerkId = null } = {}) {
  if (clerkId === excludeClerkId) {
    return // Suppress self-notification
  }

  await sendPushToUser(clerkId, payload)

  if (telegram) {
    sendTelegram(payload)
  }
}
