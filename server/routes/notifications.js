// Notification history routes (G411-98) — mounted at /api/notifications.
// Scoped by userId in every query — a user can only see/manage their own
// notification history.

import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// GET / — signed-in user's notification history, newest first.
// Deliberately unread-count-unaware for this ticket (the status is
// part of the readAt field itself, not a separate UI). `readAt` is the
// real tracking field — null means unread, set to a date means read.
router.get('/', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.clerkId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  res.json(notifications)
})

// GET /unread-count — count of unread notifications for the signed-in user.
router.get('/unread-count', requireAuth, async (req, res) => {
  const count = await prisma.notification.count({
    where: {
      userId: req.user.clerkId,
      readAt: null,
    },
  })

  res.json({ count })
})

// POST /mark-all-read — marks all unread notifications as read for the
// signed-in user. Sets readAt to now for every row where readAt is null.
router.post('/mark-all-read', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.clerkId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  res.json({ ok: true })
})

// PATCH /:id/mark-unread — per-row manual unmark (Gavi's ask, follow-up
// to the initial ticket). Scoped by userId same as every other route
// here, via updateMany so a mismatched id/owner is a silent no-op
// (0 rows affected) rather than a 404 leaking whether the id exists at
// all — matches this route file's existing userId-scoping convention.
router.patch('/:id/mark-unread', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' })
  }

  await prisma.notification.updateMany({
    where: { id, userId: req.user.clerkId },
    data: { readAt: null },
  })

  res.json({ ok: true })
})

// PATCH /:id/mark-read — per-row manual mark-read, symmetric with
// mark-unread above (a toggle needs both directions).
router.patch('/:id/mark-read', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' })
  }

  await prisma.notification.updateMany({
    where: { id, userId: req.user.clerkId },
    data: { readAt: new Date() },
  })

  res.json({ ok: true })
})

export default router
