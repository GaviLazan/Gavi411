// Request routes (G411-23 etc.) — mounted at /api/requests

import express from 'express'

const router = express.Router()

// GET / — list requests (for logged-in user, or all if admin)
// GET /:id — one request + its messages
// POST / — create a request, deduct credit
// PATCH /:id — update status/urgency (lifecycle actions, G411-30..36)

export default router
