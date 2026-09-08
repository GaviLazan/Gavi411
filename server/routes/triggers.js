// Trigger/keyword admin routes (G411-42) — mounted at /api/triggers
//
// Live CRUD over the Trigger table that lib/matchKeywords.js (G411-19)
// reads on every match — no redeploy needed to add/rename/remove a
// keyword, per PRD §6.2. Seed data (G411-20) populates the initial rows;
// this is just the admin-editable layer on top.
import express from 'express'
import { Prisma, RequestType } from '@prisma/client'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()
const VALID_REQUEST_TYPES = Object.values(RequestType)

// GET / — list all triggers, grouped implicitly by requestType via sort
// (client groups for display). Admin-only: friends never see or need
// this list.
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const triggers = await prisma.trigger.findMany({
    orderBy: [{ requestType: 'asc' }, { keyword: 'asc' }],
  })
  res.json(triggers)
})

// POST / — add a new keyword/type pair.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { keyword, requestType } = req.body
  if (!keyword?.trim() || !requestType) {
    return res.status(400).json({ error: 'keyword and requestType are required' })
  }
  // Sibling review finding: an invalid requestType used to reach Prisma
  // and throw a PrismaClientValidationError, which isn't a
  // PrismaClientKnownRequestError — the catch below's instanceof checks
  // missed it, and with no global error handler in server.js it surfaced
  // as a raw unhandled 500. Reject it here instead, same as the missing-
  // field check above.
  if (!VALID_REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({ error: 'requestType is not a valid RequestType' })
  }
  try {
    const trigger = await prisma.trigger.create({
      data: { keyword: keyword.trim(), requestType },
    })
    res.status(201).json(trigger)
  } catch (err) {
    // Unique constraint on [keyword, requestType] (prisma/schema.prisma) —
    // same guard seed.js relies on for idempotency.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'That keyword already exists for this request type' })
    }
    throw err
  }
})

// PATCH /:id — rename an existing trigger's keyword in place (edit,
// not delete+re-add — keeps the row's id/history stable).
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { keyword } = req.body
  if (!keyword?.trim()) {
    return res.status(400).json({ error: 'keyword is required' })
  }
  try {
    const trigger = await prisma.trigger.update({
      where: { id: Number(req.params.id) },
      data: { keyword: keyword.trim() },
    })
    res.json(trigger)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'That keyword already exists for this request type' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Trigger not found' })
    }
    throw err
  }
})

// DELETE /:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.trigger.delete({ where: { id: Number(req.params.id) } })
    res.status(204).end()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Trigger not found' })
    }
    throw err
  }
})

export default router
