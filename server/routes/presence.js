// Presence toggle — manual online/offline status per PRD §4.5.
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

// GET / — read the current online/offline state and admin's public info.
// No auth required — friends need to see this to know if Gavi's available.
router.get('/', async (req, res) => {
  const presence = await prisma.presence.findUnique({
    where: { id: 'singleton' },
  })

  // Fetch admin's public-safe fields (firstName, profilePic only)
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isDeleted: false },
    select: { firstName: true, profilePic: true },
  })

  if (!presence) {
    return res.json({ isOnline: true, admin: admin || null })
  }
  res.json({ ...presence, admin: admin || null })
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
