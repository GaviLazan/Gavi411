// Presence toggle (G411-43) — manual online/offline status per PRD §4.5.
//
// Offline is informational only for friends viewing in the app — the flag
// never gates any route, never prevents requests from being accepted, and
// doesn't change how the server processes messages or state. A friend can
// still submit a request, message, or view history regardless of this
// flag — it's just a courtesy indicator that replies may be slower.

import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// GET / — read the current online/offline state.
// No auth required — friends need to see this to know if Gavi's available.
router.get('/', async (req, res) => {
  const presence = await prisma.presence.findUnique({
    where: { id: 'singleton' },
  })
  // Defensive: if the row doesn't exist (shouldn't happen post-migration,
  // but be graceful), default to online rather than erroring out and
  // blocking the entire app.
  if (!presence) {
    return res.json({ isOnline: true })
  }
  res.json(presence)
})

// PATCH / — set the online/offline state. Admin-only.
router.patch('/', requireAuth, requireAdmin, async (req, res) => {
  const { isOnline } = req.body
  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ error: 'isOnline must be a boolean' })
  }
  const presence = await prisma.presence.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', isOnline },
    update: { isOnline },
  })
  res.json(presence)
})

export default router
