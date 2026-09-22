// Invite token routes (G411-41, escrow added G411-28 stage 4) — mounted
// at /api/invites
//
// Admin creates a token (POST /), anyone can check if a token is
// currently valid (GET /:token/valid) — the latter has to be reachable
// pre-signin, since its whole job is deciding whether a visitor without a
// session yet is allowed to reach Clerk sign-in at all. Marking a token
// used happens in requireAuth (server/middleware/auth.js), at the one
// moment a brand-new User row is actually created — not here, since this
// route never sees a signed-in user.
//
// Escrow: POST / also generates a one-time passphrase and returns it in
// the response body ONLY — it is never persisted (see prisma/schema.prisma's
// PendingInvite comment). The admin UI (InviteAdmin.jsx) is the only place
// that ever sees it, and only at this moment, to build the invite link's
// URL fragment and offer it for CSV export.
//
import express from 'express'
import crypto from 'node:crypto'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { isInviteValid } from '../lib/invites.js'

const router = express.Router()

// POST / — admin creates a one-time invite token + escrow passphrase.
// Returns both so the caller can build the invite link
// (gavi411.app/?token=<token>#<passphrase>) and offer a CSV export right
// now — this response is the ONLY place the passphrase ever exists
// server-side.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { label } = req.body
  // 24 random bytes, base64url — URL-safe (no +/=  chars to encode),
  // long enough that guessing isn't a real path in.
  const token = crypto.randomBytes(24).toString('base64url')
  // 18 random bytes, base64url — shorter than the token (this one's a
  // human types-it-out-loud/copy-pastes-it-into-a-CSV value, not just a
  // machine-to-machine one), still well past brute-force range.
  const passphrase = crypto.randomBytes(18).toString('base64url')

  const invite = await prisma.pendingInvite.create({
    data: { token, label: label || null },
  })

  res.status(201).json({ ...invite, passphrase })
})

// GET / — admin lists invites (newest first) so the UI can show what's
// been generated and whether it's been used yet.
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const invites = await prisma.pendingInvite.findMany({
    orderBy: { createdAt: 'desc' },
    include: { usedByUser: { select: { firstName: true, lastName: true } } },
  })

  res.json(invites)
})

router.get('/:token/valid', async (req, res) => {
  res.json({ valid: await isInviteValid(req.params.token) })
})

router.patch('/:token/backup', requireAuth, async (req, res) => {
  const { salt, iv, ciphertext } = req.body
  if (!salt || !iv || !ciphertext) {
    return res.status(400).json({ error: 'salt, iv, and ciphertext are required' })
  }

  const result = await prisma.pendingInvite.updateMany({
    where: { token: req.params.token, usedByUserId: req.user.clerkId, backupCiphertext: null },
    data: { backupSalt: salt, backupIv: iv, backupCiphertext: ciphertext },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Invite not found, not yours, or backup already stored' })
  }
  res.status(204).end()
})

router.get('/:token/backup', requireAuth, async (req, res) => {
  const invite = await prisma.pendingInvite.findUnique({ where: { token: req.params.token } })
  if (!invite || invite.usedByUserId !== req.user.clerkId || !invite.backupCiphertext) {
    return res.status(404).json({ error: 'No backup found for this token' })
  }
  res.json({ salt: invite.backupSalt, iv: invite.backupIv, ciphertext: invite.backupCiphertext })
})

export default router
