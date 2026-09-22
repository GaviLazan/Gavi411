// Nudge-driven escalation: manual nudge #1, then auto nudge #2 at +7 days
// and auto-close at +14 days if no friend reply. A friend reply clears
// nudgedAt, ending the sequence until admin nudges again.
//
// System messages (isSystem: true) are excluded from hasAdminMessaged()'s
// refund check — they're not real admin replies.

import { Status } from '@prisma/client'
import { prisma } from './prisma.js'
import { getAdminUser } from './requestAccess.js'
import { notifyUser } from './notify.js'

// Shared by sendNudge and requests.js routes — both need a request's
// messages in the same order, so one literal instead of
// independently-maintained copies.
export const MESSAGE_INCLUDE = { message: { orderBy: { createdAt: 'asc' } } }

const DAY_MS = 24 * 60 * 60 * 1000
const NUDGE_TWO_AFTER_MS = 7 * DAY_MS
const CLOSE_AFTER_MS = 14 * DAY_MS

const NUDGE_ONE_TEXT = 'Hey, Gavi is waiting for your response'
const NUDGE_TWO_TEXT = 'Still haven\'t heard back — if I don\'t hear from you soon I\'ll likely go ahead and close this request.'

// Sends nudge #1 message, authored as the admin account. Manual only —
// called by the POST /:id/nudge route. Defensive: throws if request is
// already nudged (nudgedAt not null) or if no admin exists. Sets both the
// Message (isSystem: true) and Request.nudgedAt atomically.
export async function sendNudge(requestId, admin = null) {
  const resolvedAdmin = admin ?? (await getAdminUser(prisma))
  if (!resolvedAdmin) {
    throw new Error('No admin account found — cannot send nudge')
  }

  const result = await prisma.$transaction(async (tx) => {
    // Atomic check-and-set: only proceed if nudgedAt is currently null.
    // If 0 rows updated, someone else already nudged this request first.
    const updated = await tx.request.updateMany({
      where: { id: requestId, nudgedAt: null },
      data: { nudgedAt: new Date() },
    })
    if (updated.count === 0) {
      throw new Error('Request is already nudged — can only nudge once per cycle')
    }

    await tx.message.create({
      data: { content: NUDGE_ONE_TEXT, requestId, userId: resolvedAdmin.clerkId, isSystem: true },
    })

    return tx.request.findUnique({
      where: { id: requestId },
      include: MESSAGE_INCLUDE,
    })
  })

  notifyUser(result.userId, {
    title: 'Reminder',
    body: NUDGE_ONE_TEXT,
    requestId: requestId,
  }).catch((err) => {
    console.error('Failed to notify user of nudge:', err)
  })

  return result
}

// One pass over every WAITING_ON_USER request with nudgedAt set: sends
// nudge #2 at +7 days, closes at +14 days if still no friend reply.
//
// Re-reads status fresh inside the transaction before closing — a
// concurrent reply/PATCH could have moved it off WAITING_ON_USER since
// the top-level findMany, and that write must not be clobbered.
export async function runAutoCloseCheck() {
  const nudgedRequests = await prisma.request.findMany({
    where: { status: Status.WAITING_ON_USER, nudgedAt: { not: null } },
    select: { id: true, userId: true, nudgedAt: true, nudgeTwoSentAt: true },
  })

  const now = Date.now()
  const admin = await getAdminUser(prisma)
  if (!admin) return // nothing to author a nudge/close as — nothing to do this pass

  for (const req of nudgedRequests) {
    const nudgedAtMs = req.nudgedAt.getTime()
    const timeSinceNudgeMs = now - nudgedAtMs

    // Check if nudge #2 has already been sent this cycle (nudgeTwoSentAt is set)
    const nudgeTwoSent = req.nudgeTwoSentAt !== null

    if (nudgeTwoSent && timeSinceNudgeMs >= CLOSE_AFTER_MS) {
      // Nudge #2 already sent, 14+ days since nudge #1, and still no friend reply
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.request.findUnique({ where: { id: req.id }, select: { status: true } })
        if (fresh?.status === Status.WAITING_ON_USER) {
          await tx.request.update({ where: { id: req.id }, data: { status: Status.CLOSED } })
        }
      })

      notifyUser(req.userId, {
        title: 'Request closed',
        body: 'Your request has been automatically closed due to inactivity',
        requestId: req.id,
      }).catch((err) => {
        console.error('Failed to notify user of auto-close:', err)
      })
    } else if (!nudgeTwoSent && timeSinceNudgeMs >= NUDGE_TWO_AFTER_MS) {
      // Nudge #2 not sent yet, 7+ days since nudge #1, and no friend reply: send nudge #2
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: { content: NUDGE_TWO_TEXT, requestId: req.id, userId: admin.clerkId, isSystem: true },
        })
        await tx.request.update({
          where: { id: req.id },
          data: { nudgeTwoSentAt: new Date() },
        })
      })

      notifyUser(req.userId, {
        title: 'Reminder',
        body: NUDGE_TWO_TEXT,
        requestId: req.id,
      }).catch((err) => {
        console.error('Failed to notify user of nudge #2:', err)
      })
    }
  }
}
