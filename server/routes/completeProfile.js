// Complete profile route (G411-69) — collects phone number and optional
// profile photo on first login. Mounted at /api/me via server.js.

import express from 'express'
import { Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false
  // Strip all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  // Must be 7-15 digits (E.164 real-world range)
  return digitsOnly.length >= 7 && digitsOnly.length <= 15
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
    throw err
  }
})

export default router
