// Complete profile route (G411-69) — collects phone number and optional
// profile photo on first login. Mounted at /api/me via server.js.

import express from 'express'
import { Prisma } from '@prisma/client'
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

export default router
