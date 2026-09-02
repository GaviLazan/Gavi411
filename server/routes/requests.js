// Request routes (G411-23 etc.) — mounted at /api/requests

import express from 'express'
import multer from 'multer'
import { Status, Urgency } from '@prisma/client'
import { matchKeywords } from '../lib/matchKeywords.js'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { validateImage, uploadImage, MAX_IMAGE_BYTES } from '../lib/cloudinary.js'
import { canAccessRequest, hasAdminMessaged } from '../lib/requestAccess.js'
import { E2E_ENABLED } from '../lib/e2eConfig.js'
import { deductCredit, refundCredit } from '../lib/credits.js'
import { sendNudge } from '../lib/autoClose.js'

const router = express.Router()

// Shared by GET / (admin's opt-in ?include=messages) and GET /:id — both
// want a request's messages in the same order, so one literal instead of
// two independently-maintained copies (Sibling review finding, PR #36).
const MESSAGE_INCLUDE = { message: { orderBy: { createdAt: 'asc' } } }

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
// `?include=messages` (G411-28, admin search index): admin-only opt-in to
// get every request's messages in the same call, so the admin panel can
// build its client-side decrypted search index in one round trip instead
// of N follow-up GET /:id calls. Ignored for a non-admin caller (and for
// admin's own normal list view, which doesn't pass it) — the regular
// friend-facing list stays as lean as it's always been; messages are
// still ciphertext here either way, same trust boundary as GET /:id.
//
// `user` (G411-37, admin list screen): unconditional whenever isAdmin —
// unlike `?include=messages`, every admin list render needs the friend's
// name/avatar per row, there's no admin scenario where it's skipped. Kept
// to a narrow select (firstName/lastName/profilePic) rather than the
// whole User row — a friend's own list never gets this at all, same
// admin-only trust boundary as the messages include above.
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN'
    const where = isAdmin ? {} : { userId: req.user.clerkId }
    const includeMessages = isAdmin && req.query.include === 'messages'

    const requests = await prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(isAdmin && {
        include: {
          user: { select: { firstName: true, lastName: true, profilePic: true } },
          ...(includeMessages && MESSAGE_INCLUDE),
        },
      }),
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
    include: MESSAGE_INCLUDE,
  })

  if (!request) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (!canAccessRequest(request, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }

  res.json(request)
})

// GET /:id/public-keys — the "other party's" and "my" public key for
// this request's conversation (G411-82). A Request is always between
// exactly request.user and (any) one ADMIN — the two parties never
// change for a given request — so the caller doesn't need to know Clerk
// IDs or roles itself: if I'm the owner, the other party is an admin; if
// I'm an admin, the other party is the owner. Returns `other: null` when
// that party has no public key yet (no keypair generated — see
// prisma/schema.prisma's User.publicKey doc comment) so the client can
// treat "can't encrypt yet" as a normal, handled case.
router.get('/:id/public-keys', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const existing = await prisma.request.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (!canAccessRequest(existing, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }
  const isOwner = existing.userId === req.user.clerkId

  const other = isOwner
    // Any admin's key — a Request has exactly one friend, and today
    // there's exactly one admin (Gavi), so `role: 'ADMIN'` alone always
    // resolves unambiguously. `orderBy: createdAt: 'asc'` makes the
    // choice deterministic if a second admin account is ever added
    // (Sibling review finding — an unordered findFirst was previously
    // ambiguous: which admin's key a friend's message got encrypted
    // against could differ from which admin actually opens the thread
    // to reply, silently making that message undecryptable to them).
    //
    // Known, deliberately-unfixed gap for that same future case (Sibling
    // review, second round): this doesn't filter for a non-null
    // publicKey, so if the oldest admin never generates a key but a
    // newer one does, messaging stays blocked even though a working key
    // exists elsewhere. Not fixed now because doing so would reintroduce
    // the ambiguity the ordering above exists to prevent (which admin's
    // key gets picked would vary based on who has a key yet, not on a
    // stable rule) — a real fix needs a considered multi-admin design
    // (e.g. per-conversation admin assignment), not a quick filter here.
    // Multi-admin doesn't exist yet (G411-76 is single-admin), so this
    // is unreachable today.
    ? await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { publicKey: true },
      })
    : await prisma.user.findUnique({ where: { clerkId: existing.userId }, select: { publicKey: true } })

  res.json({ me: req.user.publicKey ?? null, other: other?.publicKey ?? null })
})

// Enum values pulled from the generated Prisma client rather than
// hand-copied, so this route can't silently drift from schema.prisma.
const STATUS_VALUES = Object.values(Status)
const URGENCY_VALUES = Object.values(Urgency)

// Legal status transitions (G411-30), per PRD §4.4. Keys are the CURRENT
// status, values are the set of statuses it may move to directly. Terminal
// states (CLOSED, CANCELLED, SELF_SOLVED) map to an empty array — reopening
// a closed request is G411-34's job (a new message, not a status PATCH) and
// isn't a transition this table needs to know about. This table alone is
// NOT the full source of truth for whether a transition is legal — most
// edges are actor-agnostic (either party can trigger them via
// canAccessRequest's bypass), but specific edges layer a named actor-gate
// on top: canSetUrgency (G411-32, urgency field) and canCloseRequest
// (G411-33, the -> CLOSED edge specifically, friend-only). Check both this
// table AND those predicates before assuming a transition is unrestricted.
//
// WAITING_ON_USER -> CLOSED is deliberately NOT listed here (G411-35):
// auto-close is a system-actor transition, not something either a friend
// or admin can trigger through this HTTP route — it's written directly by
// server/lib/autoClose.js's runAutoCloseCheck, bypassing this table and
// canCloseRequest on purpose, since neither has a vocabulary for a
// non-human actor. Adding the edge here would let a FRIEND close their
// own WAITING_ON_USER request via a plain PATCH, skipping the intended
// RESOLVED_PENDING_CONFIRMATION "did this resolve it?" confirm step
// (G411-33) — the auto-close job's own re-check (still WAITING_ON_USER,
// still stale, inside a transaction) is its sole legitimacy check instead.
const TRANSITIONS = {
  IN_QUEUE: [Status.RECEIVED, Status.CANCELLED],
  RECEIVED: [Status.WORKING_ON_IT, Status.CANCELLED],
  WORKING_ON_IT: [Status.WAITING_ON_USER, Status.RESOLVED_PENDING_CONFIRMATION, Status.CANCELLED, Status.SELF_SOLVED],
  WAITING_ON_USER: [Status.WORKING_ON_IT, Status.RESOLVED_PENDING_CONFIRMATION, Status.CANCELLED, Status.SELF_SOLVED],
  RESOLVED_PENDING_CONFIRMATION: [Status.CLOSED, Status.WORKING_ON_IT],
  CLOSED: [],
  CANCELLED: [],
  SELF_SOLVED: [],
}

// G411-31: exits that refund 1 credit, gated on no ADMIN-role user having
// messaged on the request yet (Gavi's rule — see gavi411-brain.md decision
// log; one admin message is still fine, might just be a clarifying
// question).
const REFUNDABLE_EXITS = [Status.CANCELLED, Status.SELF_SOLVED]

// G411-32: PRD §4.4 only restricts the FRIEND side ("friend may downgrade
// to no longer urgent") — says nothing about admin. Gavi's explicit call
// (see gavi411-brain.md decision log): admin gets free any-direction
// urgency control, matching the free control admin already has elsewhere
// (canAccessRequest's bypass, status transitions). A non-admin is held to
// the PRD's original narrower rule — only HIGH -> NORMAL is legal.
function canSetUrgency(existingUrgency, nextUrgency, user) {
  if (user.role === 'ADMIN') return true
  return existingUrgency === Urgency.HIGH && nextUrgency === Urgency.NORMAL
}

// G411-33: closing is friend-only, unlike every other transition on this
// route (admin can trigger those via canAccessRequest's bypass). Distinct
// from auto-close (G411-35, timeout-driven, no friend confirmation) — this
// is specifically the "did this resolve it?" manual confirm flow. Gavi's
// explicit call (see gavi411-brain.md decision log): "I want to have
// friend confirmation ... not just close on my own." Named alongside
// canSetUrgency (same actor-gating shape) rather than inlined, per Sibling
// review finding.
function canCloseRequest(nextStatus, user) {
  if (nextStatus !== Status.CLOSED) return true
  return user.role !== 'ADMIN'
}

// PATCH /:id — accepts a status/urgency update. Status changes are checked
// against TRANSITIONS above (G411-30); urgency changes are checked against
// canSetUrgency above (G411-32).
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { status, urgency } = req.body
  const data = {}

  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' })
  }
  if (urgency !== undefined && !URGENCY_VALUES.includes(urgency)) {
    return res.status(400).json({ error: 'Invalid urgency value' })
  }

  if (status === undefined && urgency === undefined) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const existing = await prisma.request.findUnique({ where: { id } })
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (!canAccessRequest(existing, req.user)) {
    return res.status(404).json({ error: 'Request not found' })
  }

  if (urgency !== undefined) {
    if (!canSetUrgency(existing.urgency, urgency, req.user)) {
      return res.status(400).json({
        error: `Cannot change urgency from ${existing.urgency} to ${urgency}`,
      })
    }
    data.urgency = urgency
  }

  if (status !== undefined) {
    if (!TRANSITIONS[existing.status].includes(status)) {
      return res.status(400).json({
        error: `Cannot move from ${existing.status} to ${status}`,
      })
    }
    if (!canCloseRequest(status, req.user)) {
      return res.status(400).json({
        error: 'Only the friend can confirm and close a request',
      })
    }
    data.status = status
  }

  // G411-31 refund: both the "has an admin messaged" check and the credit
  // refund run inside the SAME transaction as the status write (Sibling
  // review finding — reading adminMessage outside the transaction let two
  // concurrent cancels both observe "untouched" and both refund; Prisma
  // serializes concurrent transactions touching the same rows, closing
  // that race).
  const isRefundable = status !== undefined && REFUNDABLE_EXITS.includes(status)

  const updated = await prisma.$transaction(async (tx) => {
    if (isRefundable && !(await hasAdminMessaged(tx, id))) {
      await refundCredit(tx, existing.userId)
    }
    return tx.request.update({ where: { id }, data })
  })
  res.json(updated)
})

// POST /:id/nudge — admin-only manual nudge for a stale WAITING_ON_USER
// request (G411-36). Sends the same warning message the auto-close job
// (G411-35) would send on its own, just Gavi-triggered instead of
// timeout-driven. No new UI yet — backend endpoint only; the admin
// cockpit button to call this is tracked as a separate ticket (same
// deferred-UI pattern as G411-87 on the friend side).
//
// A non-admin gets 404, not 403 (Sibling review finding) — same
// information-leak-avoidance convention as every other admin/ownership
// gate on this router (see GET/PATCH /:id above): a friend probing this
// route shouldn't be able to tell the endpoint even exists.
router.post('/:id/nudge', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const existing = await prisma.request.findUnique({ where: { id } })
  if (!existing || req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (existing.status !== Status.WAITING_ON_USER) {
    return res.status(400).json({ error: 'Can only nudge a request that is waiting on the friend' })
  }

  try {
    const message = await sendNudge(id)
    res.status(201).json(message)
  } catch (err) {
    console.error('Failed to send nudge:', err)
    res.status(500).json({ error: 'Failed to send nudge' })
  }
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
    // Deduction itself now lives in lib/credits.js (G411-48 extraction —
    // behavior unchanged, same transaction-safety property).
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
        },
      })
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

  const { content, encrypted } = req.body
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
    // Ownership/existence check runs BEFORE the encryption precondition
    // below (Sibling review finding, second round) — this route's own
    // convention (see GET /:id, PATCH /:id above) is that a non-owner,
    // non-admin caller always gets 404 "Request not found" so they can't
    // even confirm the request exists. Checking the encrypted/publicKey
    // precondition first broke that: a non-owner sending encrypted:true
    // got a 400 about their own key status instead of the deliberate 404,
    // leaking that the encrypted-flag path exists before ownership was
    // ever confirmed.
    if (!canAccessRequest(existing, req.user)) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // G411-82: `encrypted` is a string over multipart/form-data ("true"),
    // a real boolean over a plain JSON body — normalize once. A sender
    // with no keypair yet (see prisma/schema.prisma's User.publicKey doc
    // comment) can't have produced a real encrypted envelope, so this is
    // rejected rather than silently accepted as unmarked plaintext — the
    // client is expected to have already blocked this case with a clear
    // error before ever reaching here (see RequestDetail.jsx); this is
    // the structural backstop, same convention as this router's other
    // checks.
    //
    // Decision #98 pause: E2E_ENABLED=false forces every new message to
    // plaintext server-side too, regardless of what the client sends —
    // the client itself no longer sends encrypted:true (see
    // e2eConfig.js/RequestDetail.jsx), but this is the structural
    // backstop for that, same reasoning as the check it replaces.
    const isEncrypted = E2E_ENABLED && (encrypted === true || encrypted === 'true')
    if (isEncrypted && !req.user.publicKey) {
      return res.status(400).json({ error: 'Your device has no encryption key on file yet' })
    }

    let imageUrl = null
    if (hasImage) {
      const uploaded = await uploadImage(req.file.buffer)
      imageUrl = uploaded.secure_url
    }

    // G411-34: sending a message on a CLOSED request reopens it — no
    // separate "reopen" button, this IS the mechanism (PRD §4.4). Target
    // status depends on who messages (see gavi411-brain.md decision log):
    // a friend reopening means Gavi hasn't seen this new activity yet
    // (IN_QUEUE — not RECEIVED, since "unseen by me right now" is the
    // real distinction, not "brand new"); an admin messaging means the
    // ball's back in the friend's court (WAITING_ON_USER), symmetric
    // with the existing WORKING_ON_IT<->WAITING_ON_USER pattern.
    //
    // Only enters a transaction on the CLOSED path (Sibling review finding
    // — the plain case, an ordinary message on a non-CLOSED request, has
    // nothing to make atomic and shouldn't pay for one). Status is
    // re-checked FRESH inside the transaction, not trusted from the
    // pre-transaction `existing` read above (also a Sibling review
    // finding — two near-simultaneous messages could otherwise both see
    // CLOSED from their own stale snapshot and both write a reopen,
    // racing on which reopenTarget wins by commit order instead of real
    // message order).
    const messageData = {
      content: hasText ? content : '',
      encrypted: isEncrypted,
      imageUrl,
      requestId: id,
      userId: req.user.clerkId,
    }

    let message
    if (existing.status === Status.CLOSED) {
      const reopenTarget = req.user.role === 'ADMIN' ? Status.WAITING_ON_USER : Status.IN_QUEUE
      message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({ data: messageData })
        const fresh = await tx.request.findUnique({ where: { id }, select: { status: true } })
        if (fresh.status === Status.CLOSED) {
          await tx.request.update({ where: { id }, data: { status: reopenTarget } })
        }
        return created
      })
    } else {
      message = await prisma.message.create({ data: messageData })
    }

    res.status(201).json(message)
  } catch (err) {
    console.error('Failed to create message:', err)
    res.status(500).json({ error: 'Failed to create message' })
  }
})

export default router
