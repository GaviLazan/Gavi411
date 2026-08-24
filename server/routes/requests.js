// Request routes (G411-23 etc.) — mounted at /api/requests

import express from 'express'
import { matchKeywords } from '../lib/matchKeywords.js'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// Drop "", null, undefined before saving (decision #55); keeps `false`/`0`.
function stripEmpty(details) {
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

    result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

// Not yet built: GET / (list), GET /:id (one + messages), PATCH /:id
// (status/urgency, G411-30..36).

// POST /match — keyword-match free text against the Trigger table
// (G411-19). Called once from the intake form's Continue action.
// requireAuth added 2026-08-24 (real gap found in a live-state review) —
// was reachable unauthenticated; App.jsx already gates the intake form
// behind sign-in (G411-66), this is the backend backstop for the same rule.
router.post('/match', requireAuth, async (req, res) => {
  const { freeText } = req.body
  const matchedTypes = await matchKeywords(freeText)
  res.json({ matchedTypes })
})

// POST / — create a request + deduct credit (G411-23). Not covered here:
// overdraft (G411-47), Telegram notify (G411-50/51), credit display (G411-45).
router.post('/', requireAuth, async (req, res) => {
  const { freeText, type, urgency, additionalInfo, typeDetails } = req.body

  if (!freeText) {
    return res.status(400).json({ error: 'freeText is required' })
  }

  // Frontend's 'NONE' sentinel (zero-match/"None of these") has no DB
  // enum value — `type` is nullable for exactly this case.
  const requestType = type === 'NONE' ? null : type

  const cleanedTypeDetails = stripEmpty(typeDetails)

  try {
    // Balance re-checked fresh inside the tx (not req.user's stale
    // snapshot) so concurrent requests can't double-decrement past zero.
    const request = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { clerkId: req.user.clerkId },
        select: { creditBalance: true },
      })

      if (user.creditBalance < 1) {
        const err = new Error('Insufficient credit balance')
        err.statusCode = 402
        throw err
      }

      const created = await tx.request.create({
        data: {
          freeText,
          type: requestType,
          urgency,
          additionalInfo: additionalInfo || null,
          typeDetails: cleanedTypeDetails,
          userId: req.user.clerkId,
        },
      })

      await tx.user.update({
        where: { clerkId: req.user.clerkId },
        data: { creditBalance: { decrement: 1 } },
      })

      await tx.creditTransaction.create({
        data: {
          amount: -1,
          userId: req.user.clerkId,
        },
      })

      return created
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
