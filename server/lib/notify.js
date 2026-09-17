// G411-51: Notification dispatch helpers for push notifications across
// the request lifecycle. Centralizes admin/user lookup and suppresses
// self-notification (actor doesn't get notified of their own action).
// Web Push is the primary channel for everyone (friends and admin);
// Telegram is a secondary Gavi-only channel, deprioritized behind Web Push
// (G411-45/#93). Real Telegram wiring lives in G411-50; this file is just
// the stub/integration point.

import { prisma } from './prisma.js'
import { sendPushToUser } from './webPush.js'

// Sibling review finding: a missing TELEGRAM_BOT_TOKEN/CHAT_ID used to fail
// silently as a generic 404 logged like a transient outage. Fail loud
// instead, matching webPush.js's ensureVapidConfigured() for the same class
// of problem.
function ensureTelegramConfigured() {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error(
      'Telegram is misconfigured: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set (see .env.example). Telegram notifications cannot be sent until this is fixed.',
    )
  }
}

// Telegram's sendMessage has a hard 4096 UTF-8 character limit. body is the
// only unbounded piece (freeText has no length cap elsewhere in the app) —
// title and link are always short and must always survive intact, so body
// is truncated by however much the actual title/link/newlines need,
// computed here where all three are actually known (Sibling review finding,
// G411-50: a guessed static margin in the caller can't account for title
// length varying with the admin's real name).
const TELEGRAM_MESSAGE_LIMIT = 4096
function buildTelegramText(title, body, link) {
  const suffix = link ? `\n\n${link}` : ''
  const overhead = title.length + 1 + suffix.length // +1 for the title/body newline
  const maxBodyLength = TELEGRAM_MESSAGE_LIMIT - overhead
  const truncatedBody = body.length > maxBodyLength ? body.slice(0, Math.max(0, maxBodyLength)) : body
  return `${title}\n${truncatedBody}${suffix}`
}

// Real Telegram Bot API call (G411-50). Constructs a message from title/body/link
// and POSTs to Telegram. Catches and logs errors internally so failures don't
// propagate up to the caller.
async function sendTelegram(payload) {
  const { title, body, link } = payload
  const text = buildTelegramText(title, body, link)

  try {
    ensureTelegramConfigured()
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
        }),
      },
    )
    if (!response.ok) {
      console.error(`Telegram API error: ${response.status} ${response.statusText}`)
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err.message)
  }
}

// Sends payload to Telegram if the telegram option is set. Shared by
// notifyAdmins/notifyUser so the dispatch and its await live in one place.
function maybeSendTelegram(payload, telegram) {
  return telegram ? sendTelegram(payload) : Promise.resolve()
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

  await maybeSendTelegram(payload, telegram)
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

  await maybeSendTelegram(payload, telegram)
}
