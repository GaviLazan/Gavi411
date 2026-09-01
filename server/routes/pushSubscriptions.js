// Web Push subscription routes (G411-29) — mounted at /api/push. Registers/
// deregisters browser push subscriptions against a signed-in user. The
// browser-side subscribe prompt/permission UI is G411-49's job — this route
// just stores whatever subscription object the browser hands it.

import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// POST / — register (or re-register) a subscription for the signed-in
// user. `endpoint` is unique per browser install, so upsert rather than
// insert: the same browser re-subscribing (e.g. after this call failed
// once) must not create a duplicate row.
router.post('/', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body
  if (
    typeof endpoint !== 'string' ||
    !endpoint ||
    typeof keys?.p256dh !== 'string' ||
    !keys.p256dh ||
    typeof keys?.auth !== 'string' ||
    !keys.auth
  ) {
    return res.status(400).json({ error: 'endpoint and keys.{p256dh,auth} must be non-empty strings' })
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.user.clerkId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.user.clerkId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  })

  res.status(201).json(subscription)
})

// DELETE / — unsubscribe (browser permission revoked, or user opted out).
// Scoped to the signed-in user's own subscriptions only — a userId match
// is required, not just an endpoint match, so one user can't delete
// another's row by guessing/replaying an endpoint string.
router.delete('/', requireAuth, async (req, res) => {
  const { endpoint } = req.body
  if (typeof endpoint !== 'string' || !endpoint) {
    return res.status(400).json({ error: 'endpoint must be a non-empty string' })
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: req.user.clerkId },
  })

  res.status(204).end()
})

export default router
