// Auto-close job (G411-35) — a WAITING_ON_USER request that's been
// inactive for 14 days auto-closes, with a warning message sent 2 days
// before that (PRD §4.4). Also backs the manual nudge endpoint (G411-36),
// which sends the same warning content on demand.
//
// "Inactivity" is measured from the LAST MESSAGE's createdAt (or the
// request's own createdAt if it has no messages yet) — NOT
// Request.updatedAt. A status/urgency PATCH bumps updatedAt via Prisma's
// @updatedAt but a new Message never touches the Request row, so
// updatedAt would go stale the moment the friend actually replies without
// also changing status. See prisma/schema.prisma's Request/Message models.
//
// "Already warned, still no reply" is read off existing data rather than
// a new column: the warning IS a Message, authored by an admin (no
// system-message concept exists in this schema — Gavi's call). So "last
// message on the request is from an admin" means the friend hasn't
// replied since the last nudge/warning went out.

import { Status } from '@prisma/client'
import { prisma } from './prisma.js'

const DAY_MS = 24 * 60 * 60 * 1000
const CLOSE_AFTER_MS = 14 * DAY_MS
const WARNING_LEAD_MS = 2 * DAY_MS

export const AUTO_CLOSE_WARNING_TEXT =
  "This request has been quiet for a while — if we don't hear back in the next couple of days, we'll go ahead and close it. Just reply here to keep it open."

// The admin account a system-ish message gets authored as. Same lookup
// requests.js's GET /:id/public-keys already uses for "the" admin —
// ordered by createdAt so it's deterministic if a second admin ever
// exists (same reasoning as that route).
async function getAdminUser(db) {
  return db.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })
}

// Sends the warning/nudge message, authored as the admin account. Used by
// both the auto-close job and the manual nudge endpoint. Throws if no
// admin account exists yet (shouldn't happen post-G411-76, but fail loud
// rather than silently no-op).
export async function sendNudge(requestId) {
  const admin = await getAdminUser(prisma)
  if (!admin) {
    throw new Error('No admin account found — cannot send nudge/warning message')
  }
  return prisma.message.create({
    data: { content: AUTO_CLOSE_WARNING_TEXT, requestId, userId: admin.clerkId },
  })
}

// Runs one pass of the auto-close check over every WAITING_ON_USER
// request. For each: closes it if inactive 14+ days AND the last message
// was already the admin's warning (i.e. the friend never replied to it);
// otherwise sends the warning if inactive 12+ days and hasn't been warned
// yet. One request gets at most one action per pass.
export async function runAutoCloseCheck() {
  const staleRequests = await prisma.request.findMany({
    where: { status: Status.WAITING_ON_USER },
    select: { id: true, createdAt: true },
  })

  const now = Date.now()
  const admin = await getAdminUser(prisma)

  for (const req of staleRequests) {
    const lastMessage = await prisma.message.findFirst({
      where: { requestId: req.id },
      orderBy: { createdAt: 'desc' },
    })
    const lastActivityAt = lastMessage ? lastMessage.createdAt : req.createdAt
    const inactiveMs = now - lastActivityAt.getTime()
    const alreadyWarned = admin && lastMessage && lastMessage.userId === admin.clerkId

    if (alreadyWarned && inactiveMs >= CLOSE_AFTER_MS) {
      await prisma.request.update({ where: { id: req.id }, data: { status: Status.CLOSED } })
    } else if (!alreadyWarned && inactiveMs >= CLOSE_AFTER_MS - WARNING_LEAD_MS) {
      await sendNudge(req.id)
    }
  }
}
