// Notification dispatch helpers. Web Push primary channel; Telegram secondary (Gavi-only).

import { prisma } from './prisma.js'
import { sendPushToUser } from './webPush.js'

// Fail loud on missing Telegram config, matching webPush.js's pattern.
function ensureTelegramConfigured() {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error(
      'Telegram is misconfigured: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set (see .env.example). Telegram notifications cannot be sent until this is fixed.',
    )
  }
}

// Telegram message limit: 4096 UTF-8 chars. Title/link are short and stay intact; body is truncated.
const TELEGRAM_MESSAGE_LIMIT = 4096
function buildTelegramText(title, body, link) {
  const suffix = link ? `\n\n${link}` : ''
  const overhead = title.length + 1 + suffix.length // +1 for the title/body newline
  const maxBodyLength = TELEGRAM_MESSAGE_LIMIT - overhead
  const truncatedBody = body.length > maxBodyLength ? body.slice(0, Math.max(0, maxBodyLength)) : body
  return `${title}\n${truncatedBody}${suffix}`
}

// POSTs a message to Telegram. Catches and logs errors internally.
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

// Conditionally sends to Telegram based on options.
function maybeSendTelegram(payload, telegram) {
  return telegram ? sendTelegram(payload) : Promise.resolve()
}

// Notifies all admins via push (and optionally Telegram). Suppresses self-notification.
export async function notifyAdmins(payload, { telegram = false, excludeClerkId = null } = {}) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })

  await Promise.all(
    admins
      .filter((admin) => admin.clerkId !== excludeClerkId)
      .map((admin) => sendPushToUser(admin.clerkId, payload)),
  )

  await maybeSendTelegram(payload, telegram)
}

// Notifies a specific user via push (and optionally Telegram). Suppresses self-notification.
export async function notifyUser(clerkId, payload, { telegram = false, excludeClerkId = null } = {}) {
  if (clerkId === excludeClerkId) {
    return // Suppress self-notification
  }

  await sendPushToUser(clerkId, payload)

  await maybeSendTelegram(payload, telegram)
}
