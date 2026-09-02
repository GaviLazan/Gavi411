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
// a new column: the warning IS a Message with EXACT content
// AUTO_CLOSE_WARNING_TEXT, authored by an admin (no system-message
// concept exists in this schema — Gavi's call). Checking exact warning
// content, not just "last message is from an admin" (Sibling review
// finding — the earlier version treated ANY admin reply as an implicit
// warning, so a normal conversational admin message could silently skip
// the mandated warning and let a request auto-close with no warning ever
// sent, violating PRD §4.4's "warning sent first" contract).

import { Status } from '@prisma/client'
import { prisma } from './prisma.js'
import { getAdminUser, AUTO_CLOSE_WARNING_TEXT } from './requestAccess.js'

const DAY_MS = 24 * 60 * 60 * 1000
const CLOSE_AFTER_MS = 14 * DAY_MS
const WARNING_LEAD_MS = 2 * DAY_MS

// Re-exported so existing importers of AUTO_CLOSE_WARNING_TEXT from this
// module (the nudge route, tests) don't need to change their import path
// — the constant itself now lives in requestAccess.js so hasAdminMessaged
// can exclude it without a circular import (see that file's comment).
export { AUTO_CLOSE_WARNING_TEXT }

// Sends the warning/nudge message, authored as the admin account. Used by
// both the auto-close job and the manual nudge endpoint. `admin` can be
// passed in by a caller that already has it (runAutoCloseCheck, avoiding
// a redundant lookup per nudge sent — Sibling review finding); looked up
// fresh otherwise (e.g. the standalone POST /:id/nudge route). Throws if
// no admin account exists (shouldn't happen post-G411-76, but fail loud
// rather than silently no-op).
export async function sendNudge(requestId, admin = null) {
  const resolvedAdmin = admin ?? (await getAdminUser(prisma))
  if (!resolvedAdmin) {
    throw new Error('No admin account found — cannot send nudge/warning message')
  }
  return prisma.message.create({
    data: { content: AUTO_CLOSE_WARNING_TEXT, requestId, userId: resolvedAdmin.clerkId },
  })
}

// Runs one pass of the auto-close check over every WAITING_ON_USER
// request. For each: closes it if inactive 14+ days AND the last message
// was already the admin's warning (i.e. the friend never replied to it);
// otherwise sends the warning if inactive 12+ days and hasn't been warned
// yet. One request gets at most one action per pass.
//
// ponytail: no lock/dedup between this scheduled pass and a concurrent
// manual POST /:id/nudge on the same request — an admin nudging right as
// the 6-hourly job also decides to warn the same request can produce two
// warning messages back-to-back. Low-probability (needs both to land in
// the same tiny window) and low-severity (a duplicate friendly message,
// not data loss or a wrong close) — upgrade to a per-request advisory
// lock or a "skip if warned in the last hour" check if this ever proves
// to actually happen.
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
  const staleRequests = await prisma.request.findMany({
    where: { status: Status.WAITING_ON_USER },
    select: { id: true, createdAt: true },
  })

  const now = Date.now()
  const admin = await getAdminUser(prisma)
  if (!admin) return // nothing to author a warning/close as — nothing to do this pass

  for (const req of staleRequests) {
    const lastMessage = await prisma.message.findFirst({
      where: { requestId: req.id },
      orderBy: { createdAt: 'desc' },
    })
    const lastActivityAt = lastMessage ? lastMessage.createdAt : req.createdAt
    const inactiveMs = now - lastActivityAt.getTime()
    const alreadyWarned =
      lastMessage && lastMessage.userId === admin.clerkId && lastMessage.content === AUTO_CLOSE_WARNING_TEXT

    if (alreadyWarned && inactiveMs >= CLOSE_AFTER_MS) {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.request.findUnique({ where: { id: req.id }, select: { status: true } })
        if (fresh?.status === Status.WAITING_ON_USER) {
          await tx.request.update({ where: { id: req.id }, data: { status: Status.CLOSED } })
        }
      })
    } else if (!alreadyWarned && inactiveMs >= CLOSE_AFTER_MS - WARNING_LEAD_MS) {
      await sendNudge(req.id, admin)
    }
  }
}
