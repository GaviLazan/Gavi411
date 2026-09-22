import express from 'express'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { creditDeltaForTierChange } from '../../lib/credits.js'
import { clerkClient } from '@clerk/express'
import { isValidPhoneNumber, notifyAdminOfAccountDeletion } from '../completeProfile.js'

const router = express.Router()

// GET /users — list all users for admin's dropdown
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      // admin-only: excludes ADMIN so admin can't select themselves
      where: { role: { not: 'ADMIN' } },
      select: {
        clerkId: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        groupTag: true,
        creditBalance: true,
        isDeleted: true,
        isBlocked: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
    res.json(users)
  } catch (err) {
    console.error('Failed to load users:', err)
    res.status(500).json({ error: 'Failed to load users' })
  }
})

// PATCH /users/:userId/group-tag — update a user's group tier
router.patch('/users/:userId/group-tag', requireAuth, requireAdmin, async (req, res) => {
  const { groupTag } = req.body
  const validTags = ['LIMITED', 'REGULAR', 'CLOSE']

  if (!groupTag || !validTags.includes(groupTag)) {
    return res.status(400).json({ error: `groupTag must be one of: ${validTags.join(', ')}` })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { clerkId: req.params.userId },
        select: { role: true, groupTag: true, creditBalance: true },
      })
      if (!existing) {
        const err = new Error('User not found')
        err.statusCode = 404
        throw err
      }
      // admin-only: enforce this server-side even if UI validation is bypassed
      if (existing.role === 'ADMIN') {
        const err = new Error('User not found')
        err.statusCode = 404
        throw err
      }

      const delta = creditDeltaForTierChange(existing.groupTag, groupTag, existing.creditBalance)
      const user = await tx.user.update({
        where: { clerkId: req.params.userId },
        data: { groupTag, creditBalance: { increment: delta } },
        select: { clerkId: true, groupTag: true, creditBalance: true },
      })

      if (delta !== 0) {
        await tx.creditTransaction.create({
          data: { amount: delta, userId: req.params.userId },
        })
      }

      return user
    })
    res.json(updated)
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    console.error('Failed to update group tag:', err)
    res.status(500).json({ error: 'Failed to update group tag' })
  }
})

// PATCH /users/:userId/credit-adjustment — admin-only one-time credit adjustment
router.patch('/users/:userId/credit-adjustment', requireAuth, requireAdmin, async (req, res) => {
  const { delta } = req.body

  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero integer' })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { clerkId: req.params.userId },
        select: { role: true, creditBalance: true },
      })
      if (!existing) {
        const err = new Error('User not found')
        err.statusCode = 404
        throw err
      }
      if (existing.role === 'ADMIN') {
        const err = new Error('User not found')
        err.statusCode = 404
        throw err
      }

      const newBalance = existing.creditBalance + delta
      if (newBalance < 0) {
        const err = new Error('Balance cannot go below 0')
        err.statusCode = 400
        throw err
      }

      const user = await tx.user.update({
        where: { clerkId: req.params.userId },
        data: { creditBalance: { increment: delta } },
        select: { clerkId: true, creditBalance: true },
      })

      await tx.creditTransaction.create({
        data: { amount: delta, userId: req.params.userId },
      })

      return user
    })
    res.json(updated)
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }
    console.error('Failed to adjust credit:', err)
    res.status(500).json({ error: 'Failed to adjust credit' })
  }
})

// PATCH /users/:userId/info — admin-only update of user basic info
router.patch('/users/:userId/info', requireAuth, requireAdmin, async (req, res) => {
  const { firstName, lastName, phoneNumber } = req.body
  const data = {}

  if (firstName !== undefined) data.firstName = firstName
  if (lastName !== undefined) data.lastName = lastName
  if (phoneNumber !== undefined) {
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Please enter a valid phone number' })
    }
    data.phoneNumber = phoneNumber
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { clerkId: req.params.userId },
      select: { role: true },
    })
    if (!existing || existing.role === 'ADMIN') {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = await prisma.user.update({
      where: { clerkId: req.params.userId },
      data,
      select: { clerkId: true, firstName: true, lastName: true, phoneNumber: true },
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That phone number is already registered to another account' })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    console.error('Failed to update user info:', err)
    res.status(500).json({ error: 'Failed to update user info' })
  }
})

// PATCH /users/:userId/block — admin-only toggle block status
router.patch('/users/:userId/block', requireAuth, requireAdmin, async (req, res) => {
  const { blocked } = req.body

  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'blocked must be a boolean' })
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { clerkId: req.params.userId },
      select: { role: true },
    })
    if (!existing || existing.role === 'ADMIN') {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = await prisma.user.update({
      where: { clerkId: req.params.userId },
      data: { isBlocked: blocked },
      select: { clerkId: true, isBlocked: true },
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    console.error('Failed to update block status:', err)
    res.status(500).json({ error: 'Failed to update block status' })
  }
})

// DELETE /users/:userId — admin-only soft-delete of a user account
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { clerkId: req.params.userId },
      select: { role: true },
    })
    if (!existing || existing.role === 'ADMIN') {
      return res.status(404).json({ error: 'User not found' })
    }

    const deletedUser = await prisma.user.update({
      where: { clerkId: req.params.userId },
      data: {
        isDeleted: true,
        email: null,
        phoneNumber: `deleted-${req.params.userId}`,
        profilePic: null,
        publicKey: null,
      },
    })

    // Delete Clerk record after Prisma succeeds
    try {
      await clerkClient.users.deleteUser(req.params.userId)
    } catch (clerkErr) {
      console.error(`Failed to delete Clerk user ${req.params.userId}:`, clerkErr)
    }

    notifyAdminOfAccountDeletion(deletedUser).catch((err) => {
      console.error(`Failed to notify admins of account deletion for ${req.params.userId}:`, err)
    })

    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    console.error('Failed to delete user:', err)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

export default router
