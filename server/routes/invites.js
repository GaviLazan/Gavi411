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
// URL fragment and offer it for CSV export. PATCH /:token/backup (no auth
// — same reasoning as GET /:token/valid, a brand-new signup hasn't fully
// landed a session-linked flow yet) lets the friend's browser upload the
// encrypted backup once it's wrapped client-side. GET /:token/backup (no
// auth, by design — the recovery page itself is the gate: without the
// passphrase from the URL fragment, the returned ciphertext is useless)
// lets a lost-device recovery page fetch it back.

import express from 'express'
import crypto from 'node:crypto'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { isInviteValid } from '../lib/invites.js'

const router = express.Router()

// POST / — admin creates a one-time invite token + escrow passphrase.
// Returns both so the caller can build the invite link
// (gavi411.app/?token=<token>#<passphrase>) and offer a CSV export right
// now — this response is the ONLY place the passphrase ever exists
// server-side.
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Not found' })
  }

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

// PATCH /:token/backup — the friend's browser uploads its escrow backup
// once, right after signup (client wraps the private key with
// crypto.js's escrowPrivateKey() using the passphrase from the URL
// fragment — see App.jsx/client/src/lib/crypto.js). No auth: this fires
// in the same brief pre-"fully signed in" window as the /:token/valid
// check, and the token itself (a 24-byte random secret only the invite
// recipient has) is the actual access control here, same reasoning as
// that route. Only accepted once per token (won't overwrite an existing
// backup) — a second call is either a bug or someone replaying a token
// they don't own, neither should silently clobber a real backup.
router.patch('/:token/backup', async (req, res) => {
  const { salt, iv, ciphertext } = req.body
  if (!salt || !iv || !ciphertext) {
    return res.status(400).json({ error: 'salt, iv, and ciphertext are required' })
  }

  const result = await prisma.pendingInvite.updateMany({
    where: { token: req.params.token, backupCiphertext: null },
    data: { backupSalt: salt, backupIv: iv, backupCiphertext: ciphertext },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Invite not found or backup already stored' })
  }
  res.status(204).end()
})

// GET /:token/backup — fetches the encrypted backup for recovery. No auth
// by design (same reasoning as /:token/valid and the PATCH above): the
// recovery page can only do anything useful with this ciphertext if it
// also has the passphrase from the URL fragment, which never reaches the
// server. Without it, this response is just noise to an attacker.
router.get('/:token/backup', async (req, res) => {
  const invite = await prisma.pendingInvite.findUnique({ where: { token: req.params.token } })
  if (!invite || !invite.backupCiphertext) {
    return res.status(404).json({ error: 'No backup found for this token' })
  }
  res.json({ salt: invite.backupSalt, iv: invite.backupIv, ciphertext: invite.backupCiphertext })
})

export default router
