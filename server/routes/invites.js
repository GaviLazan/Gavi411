// Invite token routes (G411-41) — mounted at /api/invites
//
// Two endpoints: admin creates a token (POST /), anyone can check if a
// token is currently valid (GET /:token/valid) — the latter has to be
// reachable pre-signin, since its whole job is deciding whether a
// visitor without a session yet is allowed to reach Clerk sign-in at
// all. Marking a token used happens in requireAuth (server/middleware/
// auth.js), at the one moment a brand-new User row is actually created —
// not here, since this route never sees a signed-in user.

import express from 'express'
import crypto from 'node:crypto'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { isInviteValid } from '../lib/invites.js'

const router = express.Router()

// POST / — admin creates a one-time invite token. Returns the token so
// the caller can build the invite link (gavi411.app/?token=<token>).
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Not found' })
  }

  const { label } = req.body
  // 24 random bytes, base64url — URL-safe (no +/=  chars to encode),
  // long enough that guessing isn't a real path in.
  const token = crypto.randomBytes(24).toString('base64url')

  const invite = await prisma.pendingInvite.create({
    data: { token, label: label || null },
  })

  res.status(201).json(invite)
})

// GET / — admin lists invites (newest first) so the UI can show what's
// been generated and whether it's been used yet.
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Not found' })
  }

  const invites = await prisma.pendingInvite.findMany({
    orderBy: { createdAt: 'desc' },
    include: { usedByUser: { select: { firstName: true, lastName: true } } },
  })

  res.json(invites)
})

// GET /:token/valid — no auth required by design: this is the gate a
// signed-out visitor's browser checks before Clerk sign-in is even
// shown. Uses the same validity notion as requireAuth's real gate
// (lib/invites.js) — previously each re-implemented its own check,
// which could drift out of sync (Sibling review finding, G411-81).
router.get('/:token/valid', async (req, res) => {
  res.json({ valid: await isInviteValid(req.params.token) })
})

export default router
