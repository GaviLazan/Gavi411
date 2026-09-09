// G411-93: Nudge-driven escalation system (unified manual nudge + auto-close).
// Replaces the old 12-day-warn/14-day-close logic with a two-nudge sequence:
// (1) Manual nudge #1 only: admin must explicitly nudge once per cycle.
// (2) Auto-escalation, triggered only if nudged:
//     - Nudge #2 at +7 days (auto-fired if no friend reply since nudge #1)
//     - Auto-close at +14 days (if nudge #2 sent and still no friend reply)
// (3) Friend reply resets: any friend message clears nudgedAt, ending the
//     escalation sequence until admin nudges again.
//
// "Inactivity" is measured from the LAST MESSAGE's createdAt (or the
// request's own createdAt if it has no messages yet) — NOT Request.updatedAt.
// A status/urgency PATCH bumps updatedAt via Prisma's @updatedAt but a new
// Message never touches the Request row, so updatedAt would go stale the
// moment the friend actually replies without also changing status. See
// prisma/schema.prisma's Request/Message models.
//
// System messages (nudge #1, nudge #2, marked with isSystem: true) are
// authored as the admin account but not "admin replies" for refund purposes —
// hasAdminMessaged() excludes them (G411-31/93).

import { Status } from '@prisma/client'
import { prisma } from './prisma.js'
import { getAdminUser } from './requestAccess.js'

// Shared by sendNudge and requests.js routes — both need a request's
// messages in the same order, so one literal instead of
// independently-maintained copies.
export const MESSAGE_INCLUDE = { message: { orderBy: { createdAt: 'asc' } } }

const DAY_MS = 24 * 60 * 60 * 1000
const NUDGE_TWO_AFTER_MS = 7 * DAY_MS
const CLOSE_AFTER_MS = 14 * DAY_MS

// Nudge copy strings (G411-93)
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

  return prisma.$transaction(async (tx) => {
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
}

// Runs one pass of the auto-close check over every WAITING_ON_USER
// request where nudgedAt is NOT null (i.e., admin has already nudged).
// For each:
// - If 7+ days since nudgedAt and nudge #2 hasn't been sent yet: send nudge #2
// - If 14+ days since nudgedAt and nudge #2 was already sent and no friend
//   reply since: close the request
// - Requests with nudgedAt null are skipped entirely — no automated action
//   fires until admin has manually nudged once.
//
// Nudge #2 is detected by checking for an isSystem message with NUDGE_TWO_TEXT
// created after the request's nudgedAt timestamp.
//
// Friend replies reset nudgedAt to null, ending the escalation sequence until
// admin nudges again (see requests.js's POST /:id/messages route).
//
// ponytail: no lock/dedup between this scheduled pass and a concurrent
// manual POST /:id/nudge on the same request — both could land in the same
// window. Low-probability and low-severity (a duplicate system message).
//
// The CLOSED write happens inside a transaction that re-reads the
// request's status FRESH immediately before writing (Sibling review
// finding — the original version read status once via the top-level
// findMany and could still close a request that had just been replied to
// or moved off WAITING_ON_USER by a concurrent PATCH/message in the gap
// between that read and this write; same TOCTOU class the reopen-on-
// message transaction in requests.js already guards against). If the
// fresh read shows the request is no longer WAITING_ON_USER, the close is
// skipped — someone else already acted on it.
export async function runAutoCloseCheck() {
  const nudgedRequests = await prisma.request.findMany({
    where: { status: Status.WAITING_ON_USER, nudgedAt: { not: null } },
    select: { id: true, nudgedAt: true, nudgeTwoSentAt: true },
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
    }
  }
}
