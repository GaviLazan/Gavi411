// Complete profile route (G411-69) — collects phone number and optional
// profile photo on first login. Mounted at /api/me via server.js.
// G411-80: extends with a /profile route for friend-initiated edits.

import express from 'express'
import { Prisma } from '@prisma/client'
import { clerkClient } from '@clerk/express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// Sibling review finding: this used to accept 7-15 digits while the
// client (CompleteProfile.jsx) requires 8-15 (dial code + local number
// combined) — a direct API call bypassing the UI could persist a 7-digit
// value the UI itself would reject as too short. Matched to the client's
// real floor since the client always sends a dial-code-prefixed string;
// no dial-code-aware parsing needed here, just the same effective bound.
function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  return digitsOnly.length >= 8 && digitsOnly.length <= 15
}

// PATCH /api/me/complete-profile — update user's phone number and optional profile photo
// Body: { phoneNumber (required), profilePic (optional) }
router.patch('/complete-profile', requireAuth, async (req, res) => {
  const { phoneNumber, profilePic } = req.body

  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Please enter a valid phone number' })
  }

  try {
    const user = await prisma.user.update({
      where: { clerkId: req.user.clerkId },
      data: {
        phoneNumber,
        ...(profilePic ? { profilePic } : {}),
      },
    })
    res.json({ user })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'That phone number is already registered to another account' })
    }
    // Sibling review finding: an unhandled P2025 (record not found —
    // e.g. the user's row was deleted between requireAuth's lookup and
    // this update) fell through to a raw unhandled 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

// PATCH /api/me/profile — update user's phone number, any time after first login
// Body: { phoneNumber (required) }
// G411-80: name/username/email/photo are NOT handled here — Gavi's call:
// Clerk's own native account modal (opened client-side via openUserProfile())
// already covers those well, no need to duplicate it. Phone is the one field
// Clerk can't manage (no Israeli-number support, see G411-69), so it's the
// only thing this route — and the profile screen's own edit UI — still owns.
router.patch('/profile', requireAuth, async (req, res) => {
  const { phoneNumber } = req.body

  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Please enter a valid phone number' })
  }

  try {
    const user = await prisma.user.update({
      where: { clerkId: req.user.clerkId },
      data: { phoneNumber },
    })
    res.json({ user })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'That phone number is already registered to another account' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

// POST /api/me/sync-from-clerk — re-fetch this user's own record from Clerk
// and write back any of username/firstName/lastName/email that drifted.
// G411-80: our DB only ever pulls these from Clerk once, at first-login
// signup (requireAuth's create-on-signup path) — a real gap Gavi caught
// live: a brand-new username set via Clerk's native account modal
// (openUserProfile(), which we deliberately rely on instead of building
// our own name/username/email/photo form — see the /profile route above)
// never reached our DB at all, not even after signing out and back in,
// since sign-in only ever re-finds the existing row, it doesn't re-create
// it. The real fix is a Clerk `user.updated` webhook (named as the
// eventual answer in requireAuth's own comment already) — that needs a
// new endpoint, signature verification, and Gavi configuring the webhook
// URL in the Clerk dashboard, a session-crossing dependency outside this
// ticket. Cheaper stopgap Gavi asked for instead: the client calls this
// route when leaving the Profile page (the one place in the app that
// sends the user to Clerk's modal), so a same-session edit is caught
// without waiting for a reload/relogin. Diffs against the current Prisma
// row and only writes fields that actually changed — not a blind
// overwrite every time this fires.
router.post('/sync-from-clerk', requireAuth, async (req, res) => {
  let clerkUser
  try {
    clerkUser = await clerkClient.users.getUser(req.user.clerkId)
  } catch (err) {
    console.error('Failed to fetch user from Clerk for sync:', err)
    return res.status(502).json({ error: 'Could not sync your account, try again' })
  }

  // Same primary-email lookup as requireAuth's own signup path — Clerk's
  // emailAddresses[0] isn't guaranteed to be the primary.
  const emails = clerkUser.emailAddresses ?? []
  const primaryEmail = emails.find((e) => e.id === clerkUser.primaryEmailAddressId)
  const email = primaryEmail?.emailAddress ?? emails[0]?.emailAddress ?? null

  const fresh = {
    username: clerkUser.username ?? null,
    firstName: clerkUser.firstName ?? '',
    lastName: clerkUser.lastName ?? '',
    email,
  }

  const changed = {}
  for (const field of ['username', 'firstName', 'lastName', 'email']) {
    if (fresh[field] !== req.user[field]) changed[field] = fresh[field]
  }

  if (Object.keys(changed).length === 0) {
    return res.json({ user: req.user, changed: false })
  }

  try {
    const user = await prisma.user.update({
      where: { clerkId: req.user.clerkId },
      data: changed,
    })
    res.json({ user, changed: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Same username/email uniqueness constraint as /profile — extremely
      // unlikely here (Clerk enforces its own uniqueness too) but if two
      // accounts somehow raced, don't silently drop the sync attempt.
      return res.status(409).json({ error: 'That information conflicts with another account' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

export default router
