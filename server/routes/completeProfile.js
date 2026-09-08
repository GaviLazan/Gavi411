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

// PATCH /api/me/profile — update user's profile (name, email, phone, photo)
// Body: { firstName?, lastName?, email?, phoneNumber?, profilePic? } — all optional
// G411-80: allows friends to edit their profile any time, not just on first login.
router.patch('/profile', requireAuth, async (req, res) => {
  const { firstName, lastName, email, phoneNumber, profilePic } = req.body

  // Validate phone if provided
  if (phoneNumber !== undefined && !isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Please enter a valid phone number' })
  }

  // Validate email if provided — simple plausible check, not RFC-complete
  if (email !== undefined) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' })
    }
  }

  // Push to Clerk first, before Prisma write (so a Clerk failure doesn't drift the DB)
  try {
    if (firstName !== undefined || lastName !== undefined) {
      const updateData = {}
      if (firstName !== undefined) updateData.firstName = firstName
      if (lastName !== undefined) updateData.lastName = lastName
      await clerkClient.users.updateUser(req.user.clerkId, updateData)
    }

    if (email !== undefined) {
      await clerkClient.users.replaceUserEmailAddress(req.user.clerkId, {
        emailAddress: email,
      })
    }

    // profilePic is NOT sent to Clerk — the client already pushed it via
    // user.setProfileImage(), so the server just persists the Clerk-hosted URL.
  } catch (err) {
    console.error('Clerk update failed:', err)
    return res.status(502).json({ error: 'Could not update your account, try again' })
  }

  // Write to Prisma — only the fields that were provided
  try {
    const user = await prisma.user.update({
      where: { clerkId: req.user.clerkId },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(profilePic !== undefined ? { profilePic } : {}),
      },
    })
    res.json({ user })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Unique constraint violation — determine which field
      const constraint = err.meta?.target?.[0] ?? 'unknown'
      if (constraint === 'email') {
        return res.status(409).json({ error: 'That email is already registered to another account' })
      }
      if (constraint === 'phoneNumber') {
        return res.status(409).json({ error: 'That phone number is already registered to another account' })
      }
      return res.status(409).json({ error: 'That information is already in use' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' })
    }
    throw err
  }
})

export default router
