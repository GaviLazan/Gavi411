// Request routes (G411-23 etc.) — mounted at /api/requests

import express from 'express'
import { matchKeywords } from '../lib/matchKeywords.js'

const router = express.Router()

// GET / — list requests (for logged-in user, or all if admin)
// GET /:id — one request + its messages
// POST / — create a request, deduct credit
// PATCH /:id — update status/urgency (lifecycle actions, G411-30..36)

// POST /match — keyword-match free text against the Trigger table (G411-19).
// Called once from the intake form's Continue action.
router.post('/match', async (req, res) => {
  const { freeText } = req.body
  const matchedTypes = await matchKeywords(freeText)
  res.json({ matchedTypes })
})

export default router
