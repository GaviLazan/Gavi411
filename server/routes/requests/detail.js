import express from 'express'
import { Status, Urgency, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../middleware/auth.js'
import { canAccessRequest, hasAdminMessaged } from '../../lib/requestAccess.js'
import { MESSAGE_INCLUDE } from '../../lib/autoClose.js'
import { refundCredit, creditDeltaForTierChange } from '../../lib/credits.js'
import { notifyAdmins, notifyUser } from '../../lib/notify.js'

const router = express.Router()

// Enum values pulled from Prisma client, not hand-copied
const STATUS_VALUES = Object.values(Status)
const URGENCY_VALUES = Object.values(Urgency)

// Legal status transitions — Terminal states (CLOSED, CANCELLED, SELF_SOLVED) map to empty array
// Route order matters: this must register after /by-public-id/:publicId and /match
const TRANSITIONS = {
  IN_QUEUE: [Status.RECEIVED, Status.CANCELLED],
  RECEIVED: [Status.WORKING_ON_IT, Status.CANCELLED],
  WORKING_ON_IT: [Status.WAITING_ON_USER, Status.RESOLVED_PENDING_CONFIRMATION, Status.CANCELLED, Status.SELF_SOLVED],
  WAITING_ON_USER: [Status.WORKING_ON_IT, Status.RESOLVED_PENDING_CONFIRMATION, Status.CANCELLED, Status.SELF_SOLVED],
  RESOLVED_PENDING_CONFIRMATION: [Status.CLOSED, Status.WORKING_ON_IT],
  CLOSED: [],
  CANCELLED: [],
  SELF_SOLVED: [],
  OVERDRAFT_PENDING: [Status.IN_QUEUE, Status.OVERDRAFT_DENIED],
  OVERDRAFT_DENIED: [],
}

// refundable exits gated on no ADMIN having messaged yet
const REFUNDABLE_EXITS = [Status.CANCELLED, Status.SELF_SOLVED]

// admin gets free any-direction control; non-admin only HIGH -> NORMAL
function canSetUrgency(existingUrgency, nextUrgency, user) {
  if (user.role === 'ADMIN') return true
  return existingUrgency === Urgency.HIGH && nextUrgency === Urgency.NORMAL
}

// closing is friend-only, unlike every other transition
function canCloseRequest(nextStatus, user) {
  if (nextStatus !== Status.CLOSED) return true
  return user.role !== 'ADMIN'
}

// overdraft approval is admin-only
function canApproveOrDenyOverdraft(existingStatus, user) {
  if (existingStatus !== Status.OVERDRAFT_PENDING) return true
  return user.role === 'ADMIN'
}

// GET /:id — one request + its messages
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const request = await prisma.request.findUnique({
    where: { id },
    include: MESSAGE_INCLUDE,
  })

  if (!request) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (!canAccessRequest(request, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }

  res.json(request)
})

// GET /:id/public-keys — the "other party's" and "my" public key for this request's conversation
router.get('/:id/public-keys', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const existing = await prisma.request.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (!canAccessRequest(existing, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }
  const isOwner = existing.userId === req.user.clerkId

  const other = isOwner
    // Any admin's key — get first by createdAt to be deterministic
    ? await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { publicKey: true },
      })
    : await prisma.user.findUnique({ where: { clerkId: existing.userId }, select: { publicKey: true } })

  res.json({ me: req.user.publicKey ?? null, other: other?.publicKey ?? null })
})

// PATCH /:id — accepts a status/urgency update
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { status, urgency } = req.body
  const data = {}

  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' })
  }
  if (urgency !== undefined && !URGENCY_VALUES.includes(urgency)) {
    return res.status(400).json({ error: 'Invalid urgency value' })
  }

  if (status === undefined && urgency === undefined) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const existing = await prisma.request.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (!canAccessRequest(existing, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (urgency !== undefined) {
    if (!canSetUrgency(existing.urgency, urgency, req.user)) {
      return res.status(400).json({
        error: `Cannot change urgency from ${existing.urgency} to ${urgency}`,
      })
    }
    data.urgency = urgency
  }

  if (status !== undefined) {
    if (!TRANSITIONS[existing.status].includes(status)) {
      return res.status(400).json({
        error: existing.status === status
          ? "This request's status already changed — refresh the page to see the latest."
          : `Can't change status from ${existing.status} to ${status} right now.`,
      })
    }
    if (!canCloseRequest(status, req.user)) {
      return res.status(400).json({
        error: 'Only the friend can confirm and close a request',
      })
    }
    if (!canApproveOrDenyOverdraft(existing.status, req.user)) {
      return res.status(400).json({
        error: 'Only an admin can approve or deny an overdraft request',
      })
    }
    data.status = status
  }

  const isRefundable = status !== undefined && REFUNDABLE_EXITS.includes(status) && !existing.isOverdraft
  let refundHappened = false
  const isUrgencyDowngrade = urgency === Urgency.NORMAL && existing.urgency === Urgency.HIGH

  const updated = await prisma.$transaction(async (tx) => {
    if (isRefundable && !(await hasAdminMessaged(tx, id))) {
      await refundCredit(tx, existing.userId)
      refundHappened = true
    }
    if (isUrgencyDowngrade) {
      await tx.message.create({
        data: { content: 'Urgency lowered to normal.', requestId: id, userId: req.user.clerkId },
      })
    }
    return tx.request.update({
      where: { id },
      data: { ...data, ...(refundHappened ? { refundedAt: new Date() } : {}) },
      include: MESSAGE_INCLUDE,
    })
  })

  const NOTIFIABLE_STATUSES = [
    Status.WAITING_ON_USER,
    Status.RESOLVED_PENDING_CONFIRMATION,
    Status.OVERDRAFT_DENIED,
  ]
  const isOverdraftApproval =
    existing.status === Status.OVERDRAFT_PENDING && status === Status.IN_QUEUE

  if ((status !== undefined && NOTIFIABLE_STATUSES.includes(status)) || isOverdraftApproval) {
    let notifyTitle = ''
    let notifyBody = ''

    if (status === Status.WAITING_ON_USER) {
      notifyTitle = 'Gavi needs more info from you'
      notifyBody = 'Gavi is waiting for your response'
    } else if (status === Status.RESOLVED_PENDING_CONFIRMATION) {
      notifyTitle = 'Done — take a look?'
      notifyBody = 'Did I manage to solve your issue?'
    } else if (status === Status.OVERDRAFT_DENIED) {
      notifyTitle = "Extra favor wasn't approved"
      notifyBody = "Your extra favor wasn't approved"
    } else if (isOverdraftApproval) {
      notifyTitle = 'Extra favor approved'
      notifyBody = "Extra favor approved, Gavi's on it"
    }

    notifyUser(
      existing.userId,
      { title: notifyTitle, body: notifyBody, requestId: id },
      { excludeClerkId: req.user.clerkId },
    ).catch((err) => {
      console.error('Failed to notify user of status change:', err)
    })
  }

  res.json(updated)
})

export default router
