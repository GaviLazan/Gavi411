// Complete profile route — collects phone number and optional profile
// photo on first login. Mounted at /api/me via server.js. Also has a
// /profile route for friend-initiated edits after first login.

import express from 'express'
import { Prisma } from '@prisma/client'
import { clerkClient } from '@clerk/express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { notifyAdmins } from '../lib/notify.js'

const router = express.Router()

export function isValidPhoneNumber(phoneNumber) {
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

// PATCH /api/me/profile — update user's phone number, any time after first login
// Body: { phoneNumber (required) }
// name/username/email/photo are NOT handled here — Clerk's own native
// account modal already covers those. Phone is the one field Clerk can't
// manage (no Israeli-number support), so it's the only thing this route owns.
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

export async function notifyAdminOfAccountDeletion(deletedUser) {
  console.log(
    `[account-deletion] ${deletedUser.firstName} ${deletedUser.lastName} (${deletedUser.clerkId}) deleted their account`,
  )

  await notifyAdmins({
    title: 'Account deleted',
    body: `${deletedUser.firstName} ${deletedUser.lastName} deleted their account`,
  })
}

// DELETE /api/me — soft-delete the caller's account
router.delete('/', requireAuth, async (req, res) => {
  try {
    // Capture name before soft-delete wipes any fields (name is NOT scrubbed,
    // but capture cleanly regardless for the notification).
    const user = await prisma.user.findUnique({
      where: { clerkId: req.user.clerkId },
    })

    if (!user) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Soft-delete: clear PII, mark deleted, preserve Request/Message/Credit history
    const deletedUser = await prisma.user.update({
      where: { clerkId: req.user.clerkId },
      data: {
        isDeleted: true,
        email: null,
        phoneNumber: `deleted-${req.user.clerkId}`,
        profilePic: null,
        publicKey: null,
      },
    })

    // Delete Clerk record AFTER Prisma succeeds — if Clerk fails, our account
    // is already locked out locally (safe), not the other way around.
    try {
      await clerkClient.users.deleteUser(req.user.clerkId)
    } catch (clerkErr) {
      // Clerk delete failure doesn't fail the whole request — the account is
      // already scrubbed/locked on our side, which is the safe state.
      console.error(`Failed to delete Clerk user ${req.user.clerkId}:`, clerkErr)
    }

    // Fire-and-forget admin notification — don't block response on push failure
    notifyAdminOfAccountDeletion(deletedUser).catch((err) => {
      console.error(`Failed to notify admins of account deletion for ${req.user.clerkId}:`, err)
    })

    res.json({ success: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

export default router
