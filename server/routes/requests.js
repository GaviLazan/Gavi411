// Request routes (G411-23 etc.) — mounted at /api/requests

import express from 'express'
import multer from 'multer'
import { Status, Urgency } from '@prisma/client'
import { matchKeywords } from '../lib/matchKeywords.js'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { validateImage, uploadImage, MAX_IMAGE_BYTES } from '../lib/cloudinary.js'

const router = express.Router()

// memoryStorage — files stay in RAM as a Buffer just long enough to
// forward to Cloudinary, never written to disk. Fine at a 10MB cap on a
// free-tier backend; would need rethinking for anything larger (see
// G411-79's video-upload scoping note on this exact risk).
//
// limits.fileSize (Sibling review finding): without this, multer buffers
// the WHOLE upload into memory before validateImage's own size check
// ever runs — a large-enough request could exhaust the free-tier
// backend's memory before the app-level check gets a chance to reject
// it. This makes multer itself abort the stream once the cap is hit,
// so validateImage's check is now a redundant-but-harmless belt-and-
// suspenders (also covers a future non-multer caller of validateImage).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } })

// Wraps upload.single('image') so a multer-level error (oversized file
// hitting the new limits.fileSize above, malformed multipart, wrong
// field name) returns this router's normal JSON error shape instead of
// falling through to Express's default HTML error page — no global
// error-handling middleware exists in server.js, so this route owns its
// own multer error handling (Sibling review finding).
function uploadImageField(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image too large (10MB max)' })
    }
    console.error('Image upload middleware error:', err)
    res.status(400).json({ error: 'Invalid image upload' })
  })
}

// Drop "", null, undefined before saving (decision #55); keeps `false`/`0`.
// Exported for a direct unit test — internal helper otherwise.
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
      // Recurse into plain nested objects too (e.g. TravelFields' hotel/car,
      // G411-74) — same emptiness rule as the top level, not just arrays.
      const cleaned = stripEmpty(value)
      if (cleaned !== undefined) result[key] = cleaned
      continue
    }

    result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

// GET / — list requests for the logged-in user, or every request if
// they're an admin (G411-67). Newest first.
//
// try/catch added 2026-08-30 (Gavi hit a real, once-off "Couldn't load
// your requests" failure while live-testing G411-81's invite flow, cause
// unconfirmed — likely a Neon/Prisma cold-start hiccup right after a
// fresh signup, never reproduced again). The old code had no error
// handling at all, so a failure here silently 500'd with no logged
// reason — kept as real error-path logging going forward (Gavi's call:
// he expects to be asked whether errors are logged, this earns its keep
// beyond just this one bug hunt), not just a debug leftover.
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { userId: req.user.clerkId }

    const requests = await prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json(requests)
  } catch (err) {
    console.error('Failed to load requests:', err)
    res.status(500).json({ error: 'Failed to load requests' })
  }
})

// GET /:id — one request + its messages (G411-67). Owner or admin only.
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const request = await prisma.request.findUnique({
    where: { id },
    include: { message: { orderBy: { createdAt: 'asc' } } },
  })

  if (!request) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (request.userId !== req.user.clerkId && req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Request not found' })
  }

  res.json(request)
})

// Enum values pulled from the generated Prisma client rather than
// hand-copied, so this route can't silently drift from schema.prisma.
const STATUS_VALUES = Object.values(Status)
const URGENCY_VALUES = Object.values(Urgency)

// PATCH /:id — route shell only (G411-67): accepts a status/urgency
// update, validates it's a legal enum value, and writes it. Does NOT
// implement lifecycle transition rules (cancel/refund, close, reopen,
// auto-close) — that's G411-30..36's job, built on top of this shell.
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { status, urgency } = req.body
  const data = {}

  if (status !== undefined) {
    if (!STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }
    data.status = status
  }

  if (urgency !== undefined) {
    if (!URGENCY_VALUES.includes(urgency)) {
      return res.status(400).json({ error: 'Invalid urgency value' })
    }
    data.urgency = urgency
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const existing = await prisma.request.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (existing.userId !== req.user.clerkId && req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Request not found' })
  }

  const updated = await prisma.request.update({ where: { id }, data })
  res.json(updated)
})

// POST /match — keyword-match free text against the Trigger table
// (G411-19). Called once from the intake form's Continue action.
// requireAuth added 2026-08-24 (real gap found in a live-state review) —
// was reachable unauthenticated; App.jsx already gates the intake form
// behind sign-in (G411-66), this is the backend backstop for the same rule.
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

// POST /:id/messages — append a message to a request's thread (G411-24;
// image upload added G411-26). Fetch-on-load side already existed (GET
// /:id includes the ordered `message` relation, built for G411-67/75) —
// this is the write half. Owner-or-admin, same convention as GET/PATCH
// :id on this router: a non-owner gets 404, not 403, so they can't even
// confirm the request exists. ADMIN role isn't assignable yet (G411-76)
// — only owners can practically hit this until then, endpoint is still
// correct either way.
//
// multer parses multipart/form-data for the optional image; a plain
// JSON POST (no image, text only) still works — multer only kicks in
// when the client actually sends multipart.
router.post('/:id/messages', requireAuth, uploadImageField, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { content } = req.body
  const hasText = content && content.trim()
  const hasImage = Boolean(req.file)
  // A photo alone (no caption) is a valid message — only reject if
  // NEITHER text nor an image was sent.
  if (!hasText && !hasImage) {
    return res.status(400).json({ error: 'content or an image is required' })
  }

  if (hasImage) {
    const validationError = validateImage(req.file)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }
  }

  try {
    const existing = await prisma.request.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' })
    }
    if (existing.userId !== req.user.clerkId && req.user.role !== 'ADMIN') {
      return res.status(404).json({ error: 'Request not found' })
    }

    let imageUrl = null
    if (hasImage) {
      const uploaded = await uploadImage(req.file.buffer)
      imageUrl = uploaded.secure_url
    }

    const message = await prisma.message.create({
      data: {
        content: hasText ? content : '',
        imageUrl,
        requestId: id,
        userId: req.user.clerkId,
      },
    })

    res.status(201).json(message)
  } catch (err) {
    console.error('Failed to create message:', err)
    res.status(500).json({ error: 'Failed to create message' })
  }
})

export default router
