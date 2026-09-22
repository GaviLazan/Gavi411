import express from 'express'
import { Status } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { sendNudge } from '../../lib/autoClose.js'

const router = express.Router()

// POST /:id/nudge — admin-only manual nudge for a stale WAITING_ON_USER request
router.post('/:id/nudge', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const existing = await prisma.request.findUnique({ where: { id } })
  if (!existing || req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (existing.status !== Status.WAITING_ON_USER) {
    return res.status(400).json({ error: 'Can only nudge a request that is waiting on the friend' })
  }
  if (existing.nudgedAt !== null) {
    return res.status(400).json({ error: 'This request is already nudged — can only nudge once per cycle' })
  }

  try {
    const request = await sendNudge(id)
    res.status(201).json(request)
  } catch (err) {
    console.error('Failed to send nudge:', err)
    res.status(500).json({ error: 'Failed to send nudge' })
  }
})

// GET /:id/notes — private admin-only notes
router.get('/:id/notes', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const existing = await prisma.request.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }

  const notes = await prisma.note.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'asc' },
  })
  res.json(notes)
})

// POST /:id/notes — create a private admin-only note
router.post('/:id/notes', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { content } = req.body
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required' })
  }

  const existing = await prisma.request.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }

  const note = await prisma.note.create({
    data: { content: content.trim(), requestId: id },
  })
  res.status(201).json(note)
})

export default router
