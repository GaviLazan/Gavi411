import express from 'express'
import { Status } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { matchKeywords } from '../../lib/matchKeywords.js'
import { deductCredit } from '../../lib/credits.js'
import { sendPushToUser } from '../../lib/webPush.js'
import { notifyAdmins } from '../../lib/notify.js'
import { generatePublicId } from '../../lib/publicId.js'
import { canAccessRequest } from '../../lib/requestAccess.js'
import { buildPermalink } from './buildPermalink.js'

const router = express.Router()

// Drop "", null, undefined before saving; keeps false/0
export function stripEmpty(details) {
  if (!details || typeof details !== 'object') return details

  const result = {}
  for (const [key, value] of Object.entries(details)) {
    if (value === '' || value === null || value === undefined) continue

    if (Array.isArray(value)) {
      const cleaned = value
        .map((entry) => stripEmpty(entry))
        .filter((entry) => entry && Object.keys(entry).length > 0)
      if (cleaned.length > 0) result[key] = cleaned
      continue
    }

    if (typeof value === 'object') {
      const cleaned = stripEmpty(value)
      if (cleaned !== undefined) result[key] = cleaned
      continue
    }

    result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

// POST /match — keyword-match free text against the Trigger table
router.post('/match', requireAuth, async (req, res) => {
  const { freeText } = req.body
  if (!freeText) {
    return res.status(400).json({ error: 'freeText is required' })
  }
  try {
    const matchedTypes = await matchKeywords(freeText)
    res.json({ matchedTypes })
  } catch (err) {
    console.error('Failed to match keywords:', err)
    res.status(500).json({ error: 'Failed to match request type' })
  }
})

// GET /by-public-id/:publicId — lookup request by public permalink ID
// Route order matters: must register before GET /:id to avoid being caught by /:id route
router.get('/by-public-id/:publicId', requireAuth, async (req, res) => {
  const { publicId } = req.params

  const request = await prisma.request.findUnique({
    where: { publicId },
    select: { id: true, userId: true },
  })

  if (!request) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (!canAccessRequest(request, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }

  res.json(request)
})

// POST / — create a request + deduct credit
router.post('/', requireAuth, async (req, res) => {
  const { freeText, type, urgency, additionalInfo, typeDetails } = req.body

  if (!freeText) {
    return res.status(400).json({ error: 'freeText is required' })
  }

  const requestType = type === 'NONE' ? null : type
  const cleanedTypeDetails = stripEmpty(typeDetails)

  try {
    const request = await prisma.$transaction(async (tx) => {
      await deductCredit(tx, req.user.clerkId)

      return tx.request.create({
        data: {
          freeText,
          type: requestType,
          urgency,
          additionalInfo: additionalInfo || null,
          typeDetails: cleanedTypeDetails,
          userId: req.user.clerkId,
          publicId: generatePublicId(),
        },
      })
    })

    notifyAdmins(
      {
        title: `New ask from ${req.user.firstName} ${req.user.lastName}`,
        body: request.urgency === 'HIGH' ? `${request.freeText}\nUrgent` : request.freeText,
        link: buildPermalink(request.publicId),
        requestId: request.id,
      },
      { telegram: true },
    ).catch((err) => {
      console.error('Failed to notify admins of new request:', err)
    })

    res.status(201).json(request)
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    console.error('Failed to create request:', err)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

// POST /overdraft-request — friend-facing "Request anyway" when blocked at 0 balance
router.post('/overdraft-request', requireAuth, async (req, res) => {
  const { freeText, type, urgency, additionalInfo, typeDetails } = req.body

  if (!freeText) {
    return res.status(400).json({ error: 'freeText is required' })
  }

  const requestType = type === 'NONE' ? null : type
  const cleanedTypeDetails = stripEmpty(typeDetails)

  try {
    const request = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { clerkId: req.user.clerkId },
        select: { creditBalance: true, overdraftUsedAt: true },
      })

      if (user.creditBalance >= 1) {
        const err = new Error('You still have credits available')
        err.statusCode = 400
        throw err
      }

      if (user.overdraftUsedAt) {
        const now = new Date()
        const usedMonth = user.overdraftUsedAt.getMonth()
        const usedYear = user.overdraftUsedAt.getFullYear()
        const sameMonth = usedMonth === now.getMonth() && usedYear === now.getFullYear()
        if (sameMonth) {
          const err = new Error('You have already used your one-time overdraft request this period')
          err.statusCode = 400
          throw err
        }
      }

      await tx.user.update({
        where: { clerkId: req.user.clerkId },
        data: { overdraftUsedAt: new Date() },
      })

      return tx.request.create({
        data: {
          freeText,
          type: requestType,
          urgency,
          additionalInfo: additionalInfo || null,
          typeDetails: cleanedTypeDetails,
          userId: req.user.clerkId,
          status: Status.OVERDRAFT_PENDING,
          isOverdraft: true,
          publicId: generatePublicId(),
        },
      })
    })

    notifyAdmins(
      {
        title: `Overdraft ask from ${req.user.firstName} ${req.user.lastName}`,
        body: request.freeText,
        link: buildPermalink(request.publicId),
        requestId: request.id,
      },
      { telegram: true },
    ).catch((err) => {
      console.error('Failed to notify admins of overdraft request:', err)
    })

    res.status(201).json(request)
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    console.error('Failed to create overdraft request:', err)
    res.status(500).json({ error: 'Failed to create overdraft request' })
  }
})

// POST /admin-create — admin creates a request on behalf of an existing user
router.post('/admin-create', requireAuth, requireAdmin, async (req, res) => {
  const { userId, freeText, type, urgency, additionalInfo, typeDetails, chargeCredit } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }
  if (!freeText) {
    return res.status(400).json({ error: 'freeText is required' })
  }

  const targetUser = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' })
  }
  if (targetUser.role === 'ADMIN') {
    return res.status(400).json({ error: 'Cannot create a request on behalf of an admin' })
  }

  const requestType = type === 'NONE' ? null : type
  const cleanedTypeDetails = stripEmpty(typeDetails)
  const shouldCharge = chargeCredit === true

  try {
    const request = await prisma.$transaction(async (tx) => {
      if (shouldCharge) await deductCredit(tx, userId)

      return tx.request.create({
        data: {
          freeText,
          type: requestType,
          urgency,
          additionalInfo: additionalInfo || null,
          typeDetails: cleanedTypeDetails,
          userId,
          publicId: generatePublicId(),
        },
      })
    })

    sendPushToUser(userId, {
      title: 'New request opened for you',
      body: 'Gavi opened a new request on your behalf — take a look.',
    }).catch((err) => {
      console.error('Failed to send admin-create notification:', err.message)
    })

    res.status(201).json(request)
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    console.error('Failed to create request:', err)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

export default router
