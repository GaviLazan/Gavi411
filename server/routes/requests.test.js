// Route tests for GET/GET:id/PATCH (G411-67). Mocks Prisma and auth —
// no real DB touched, so this is safe to run unattended against the
// live dev database this repo shares. Covers: auth-required, ownership
// checks, admin bypass, PATCH enum validation happy/error paths.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const OWNER = 'user_owner'
const OTHER = 'user_other'
const ADMIN = 'user_admin'

const DAY_MS = 24 * 60 * 60 * 1000

const usersByClerkId = {
  [OWNER]: { clerkId: OWNER, role: 'USER', publicKey: 'owner-pubkey' },
  [OTHER]: { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN', publicKey: 'admin-pubkey' },
}

// Swapped per-test via currentUserId to simulate different signed-in users.
let currentUserId = null

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' })
    req.user = usersByClerkId[currentUserId]
    next()
  },
  requireAdmin: (req, res, next) => {
    if (req.user.role !== 'ADMIN') return res.status(404).json({ error: 'Not found' })
    next()
  },
}))

const sampleRequest = {
  id: 1,
  status: 'IN_QUEUE',
  urgency: 'NORMAL',
  type: 'TRAVEL',
  freeText: 'help',
  userId: OWNER,
}

const prismaMock = {
  request: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  note: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
  // $transaction just runs the callback with `prismaMock` itself as `tx` —
  // every mock above is reachable through either the top-level prisma
  // object or the tx passed to a transaction callback, so tests can assert
  // against the same vi.fn() either way.
  $transaction: vi.fn((cb) => cb(prismaMock)),
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../lib/matchKeywords.js', () => ({ matchKeywords: vi.fn() }))

const uploadImageMock = vi.fn()
vi.mock('../lib/cloudinary.js', async () => {
  const actual = await vi.importActual('../lib/cloudinary.js')
  return { ...actual, uploadImage: (...args) => uploadImageMock(...args) }
})

// Real implementation by default (it operates on prismaMock as its `tx`
// arg, so existing tests asserting user.update/creditTransaction.create
// side effects still pass) — G411-44's tests spy on it per-test instead
// of replacing it wholesale, which broke every pre-existing deduction/
// refund assertion in this file (Sibling review finding).
vi.mock('../lib/credits.js', async () => {
  const actual = await vi.importActual('../lib/credits.js')
  return { ...actual }
})

vi.mock('../lib/webPush.js', () => ({
  sendPushToUser: vi.fn(async () => undefined),
}))

const { default: requestsRouter } = await import('./requests.js')

const app = express()
app.use(express.json())
app.use('/api/requests', requestsRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('GET /api/requests', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).get('/api/requests')
    expect(res.status).toBe(401)
  })

  it('lists only the caller\'s own requests for a non-admin', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    const res = await request(app).get('/api/requests')

    expect(res.status).toBe(200)
    expect(prismaMock.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: OWNER } })
    )
  })

  it('lists every request for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    const res = await request(app).get('/api/requests')

    expect(res.status).toBe(200)
    expect(prismaMock.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  // G411-81: real, once-off DB failure hit live while testing the invite
  // flow (cause unconfirmed) surfaced this route had no error handling
  // at all — a thrown error crashed with no logged reason.
  it('500s cleanly with a logged reason if the DB call fails', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockRejectedValue(new Error('connection lost'))

    const res = await request(app).get('/api/requests')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to load requests' })
  })

  // G411-28 admin search index — opt-in bulk messages include.
  // G411-37: by default (no ?include=messages), an admin gets only the
  // single most recent message's createdAt — not full message bodies —
  // so the admin list's "time since last activity" column has a real
  // timestamp without paying for every message on every list load.
  it('includes only the latest message timestamp by default, not full messages, for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.message).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true },
    })
  })

  it('includes messages for an admin when ?include=messages is given', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests?include=messages')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.message).toEqual({ orderBy: { createdAt: 'asc' } })
  })

  it('ignores ?include=messages for a non-admin', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests?include=messages')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include).toBeUndefined()
  })

  // G411-37 admin list screen: every admin list render needs the friend's
  // name/avatar per row (unlike ?include=messages, this is unconditional
  // whenever isAdmin, not a separate opt-in) — narrow select, not the
  // whole User row.
  it('includes a narrow user select for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.user).toEqual({
      select: { firstName: true, lastName: true, profilePic: true },
    })
  })

  it('does not include user for a non-admin', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include).toBeUndefined()
  })
})

describe('GET /api/requests/:id', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).get('/api/requests/1')
    expect(res.status).toBe(401)
  })

  it('404s for a non-owner, non-admin', async () => {
    currentUserId = OTHER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app).get('/api/requests/1')
    expect(res.status).toBe(404)
  })

  it('200s for the owner, including messages', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, message: [] })

    const res = await request(app).get('/api/requests/1')
    expect(res.status).toBe(200)
    expect(res.body.message).toEqual([])
  })

  it('200s for an admin viewing someone else\'s request', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app).get('/api/requests/1')
    expect(res.status).toBe(200)
  })

  it('404s when the request does not exist', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/requests/999')
    expect(res.status).toBe(404)
  })

  it('400s on a non-numeric id', async () => {
    currentUserId = OWNER
    const res = await request(app).get('/api/requests/not-a-number')
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/requests/:id', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-owner, non-admin', async () => {
    currentUserId = OTHER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
    expect(res.status).toBe(404)
  })

  it('400s on an invalid status value', async () => {
    currentUserId = OWNER
    const res = await request(app).patch('/api/requests/1').send({ status: 'NOT_A_STATUS' })
    expect(res.status).toBe(400)
  })

  it('400s on an invalid urgency value', async () => {
    currentUserId = OWNER
    const res = await request(app).patch('/api/requests/1').send({ urgency: 'SUPER_URGENT' })
    expect(res.status).toBe(400)
  })

  it('400s when no fields are given', async () => {
    currentUserId = OWNER
    const res = await request(app).patch('/api/requests/1').send({})
    expect(res.status).toBe(400)
  })

  it('updates status for the owner on a legal transition', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest) // IN_QUEUE
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'RECEIVED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'RECEIVED' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('RECEIVED')
    // include: messages (Gavi, live testing: a status change used to
    // silently drop request.message from client state) — this route's
    // response now always carries the current message list.
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'RECEIVED' },
      include: { message: { orderBy: { createdAt: 'asc' } } },
    })
  })

  it('allows an admin to update someone else\'s request', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })

    const res = await request(app).patch('/api/requests/1').send({ urgency: 'HIGH' })
    expect(res.status).toBe(200)
  })

  // G411-32 — urgency-change gating by role
  describe('urgency change gating (G411-32)', () => {
    it('allows a friend to downgrade HIGH -> NORMAL', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'NORMAL' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'NORMAL' })
      expect(res.status).toBe(200)
    })

    // Gavi, live testing: "I think it would be good for the user to see
    // in the messages that the urgency was lowered to normal" — a real
    // Message row, authored by whoever made the change, since the schema
    // has no system-message concept (same convention as sendNudge).
    it('creates a visible message when urgency downgrades HIGH -> NORMAL', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'NORMAL' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'NORMAL' })

      expect(res.status).toBe(200)
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: { content: 'Urgency lowered to normal.', requestId: 1, userId: OWNER },
      })
    })

    it('does NOT create a message when admin sets urgency to a non-downgrade value', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'NORMAL' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'LOW' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'LOW' })

      expect(res.status).toBe(200)
      expect(prismaMock.message.create).not.toHaveBeenCalled()
    })

    it('400s a friend trying to upgrade NORMAL -> HIGH', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'NORMAL' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'HIGH' })
      expect(res.status).toBe(400)
      expect(prismaMock.request.update).not.toHaveBeenCalled()
    })

    it('400s a friend trying to set HIGH -> LOW (not the PRD\'s NORMAL target)', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'LOW' })
      expect(res.status).toBe(400)
    })

    it('400s a friend trying to set LOW -> HIGH', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'LOW' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'HIGH' })
      expect(res.status).toBe(400)
    })

    it('allows an admin to set urgency in any direction, e.g. NORMAL -> LOW', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'NORMAL' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'LOW' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'LOW' })
      expect(res.status).toBe(200)
    })

    it('allows an admin to upgrade LOW -> HIGH', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, urgency: 'LOW' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })

      const res = await request(app).patch('/api/requests/1').send({ urgency: 'HIGH' })
      expect(res.status).toBe(200)
    })
  })

  // G411-30 — transition enforcement
  it('400s on an illegal jump (IN_QUEUE -> CLOSED, skipping the graph)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest) // IN_QUEUE

    const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Can't change status from IN_QUEUE to CLOSED right now.")
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  // Gavi, live testing: a fast double-click on ConfirmModal's "Yes" used
  // to re-send an already-applied status, hitting the generic illegal-
  // transition branch with a raw "Cannot move from SELF_SOLVED to
  // SELF_SOLVED" message — fixed client-side (ConfirmModal's busy prop)
  // and given a clearer server-side message as a backstop for any other
  // stale-state path (e.g. two tabs open). Asserting the actual text so
  // a future refactor that collapses this back to the generic message
  // fails loudly instead of silently reintroducing the confusing UX.
  it('gives a "already changed" message specifically for a same-status resubmit', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'SELF_SOLVED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'SELF_SOLVED' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("This request's status already changed — refresh the page to see the latest.")
  })

  it('400s on any transition out of a terminal status (CLOSED -> WORKING_ON_IT)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'CLOSED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'WORKING_ON_IT' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Can't change status from CLOSED to WORKING_ON_IT right now.")
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('walks the full legal chain to CLOSED, one legal edge at a time', async () => {
    currentUserId = OWNER
    const chain = [
      ['IN_QUEUE', 'RECEIVED'],
      ['RECEIVED', 'WORKING_ON_IT'],
      ['WORKING_ON_IT', 'WAITING_ON_USER'],
      ['WAITING_ON_USER', 'RESOLVED_PENDING_CONFIRMATION'],
      ['RESOLVED_PENDING_CONFIRMATION', 'CLOSED'],
    ]
    for (const [from, to] of chain) {
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: from })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: to })

      const res = await request(app).patch('/api/requests/1').send({ status: to })
      expect(res.status).toBe(200)
    }
  })

  it('allows the SELF_SOLVED exit from WORKING_ON_IT', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT' })
    prismaMock.message.findFirst.mockResolvedValue(null) // no admin message yet
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'SELF_SOLVED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'SELF_SOLVED' })
    expect(res.status).toBe(200)
  })

  it('allows the CANCELLED exit from IN_QUEUE (untouched request)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest) // IN_QUEUE
    prismaMock.message.findFirst.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CANCELLED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })
    expect(res.status).toBe(200)
  })

  // G411-31 — refund on cancel/self-solved, gated on "no admin message yet"
  describe('refund on cancel/self-solved (G411-31)', () => {
    beforeEach(() => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue(sampleRequest) // IN_QUEUE, userId: OWNER
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CANCELLED' })
    })

    it('refunds when no admin has messaged on the request yet', async () => {
      prismaMock.message.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ requestId: 1, user: { role: 'ADMIN' } }),
      })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { clerkId: OWNER },
        data: { creditBalance: { increment: 1 } },
      })
      expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
        data: { amount: 1, userId: OWNER },
      })
    })

    it('does NOT refund once an admin has sent a message (Gavi\'s "touched" rule)', async () => {
      prismaMock.message.findFirst.mockResolvedValue({ id: 99, userId: ADMIN })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
      // Status transition still happens even without a refund.
      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CANCELLED' },
        include: { message: { orderBy: { createdAt: 'asc' } } },
      })
    })

    it('also refunds on the SELF_SOLVED exit when untouched', async () => {
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'SELF_SOLVED' })
      prismaMock.message.findFirst.mockResolvedValue(null)

      const res = await request(app).patch('/api/requests/1').send({ status: 'SELF_SOLVED' })

      expect(res.status).toBe(200)
      expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
        data: { amount: 1, userId: OWNER },
      })
    })

    it('does not touch credits at all for a non-refundable transition (e.g. RECEIVED)', async () => {
      const res = await request(app).patch('/api/requests/1').send({ status: 'RECEIVED' })

      expect(res.status).toBe(200)
      expect(prismaMock.message.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
    })

    // G411-90 — track refundedAt timestamp when refund occurs
    it('sets refundedAt to current time when a CANCELLED refund happens (no admin message yet)', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
      prismaMock.message.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CANCELLED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      // Verify the update includes refundedAt
      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'CANCELLED', refundedAt: expect.any(Date) }),
        include: { message: { orderBy: { createdAt: 'asc' } } },
      })
    })

    it('sets refundedAt on a SELF_SOLVED refund too', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT' })
      prismaMock.message.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'SELF_SOLVED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'SELF_SOLVED' })

      expect(res.status).toBe(200)
      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'SELF_SOLVED', refundedAt: expect.any(Date) }),
        include: { message: { orderBy: { createdAt: 'asc' } } },
      })
    })

    it('does NOT set refundedAt when admin has already messaged (refund blocked)', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
      prismaMock.message.findFirst.mockResolvedValue({ id: 99, userId: ADMIN })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CANCELLED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      // Verify the update does NOT include refundedAt (no refund happened)
      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CANCELLED' },
        include: { message: { orderBy: { createdAt: 'asc' } } },
      })
    })
  })

  // G411-33 — close is friend-only
  describe('close is friend-only (G411-33)', () => {
    it('allows a friend to close from RESOLVED_PENDING_CONFIRMATION', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'RESOLVED_PENDING_CONFIRMATION' })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CLOSED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
      expect(res.status).toBe(200)
    })

    it('400s an admin trying to close directly', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'RESOLVED_PENDING_CONFIRMATION' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
      expect(res.status).toBe(400)
      expect(prismaMock.request.update).not.toHaveBeenCalled()
    })
  })
})

// No coverage existed for POST / (create + deduct) before G411-48's
// extraction into lib/credits.js — real gap, added here.
describe('POST /api/requests (G411-23, deduction via lib/credits.js)', () => {
  beforeEach(() => {
    currentUserId = OWNER
  })

  it('401s when unauthenticated', async () => {
    currentUserId = null
    const res = await request(app).post('/api/requests').send({ freeText: 'help' })
    expect(res.status).toBe(401)
  })

  it('400s when freeText is missing', async () => {
    const res = await request(app).post('/api/requests').send({})
    expect(res.status).toBe(400)
  })

  it('creates the request and deducts 1 credit when balance allows', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.request.create.mockResolvedValue({ id: 1, freeText: 'help', userId: OWNER })

    const res = await request(app).post('/api/requests').send({ freeText: 'help' })

    expect(res.status).toBe(201)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: OWNER },
      data: { creditBalance: { decrement: 1 } },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })

  it('402s and creates nothing when balance is below 1', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0 })

    const res = await request(app).post('/api/requests').send({ freeText: 'help' })

    expect(res.status).toBe(402)
    expect(prismaMock.request.create).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/requests/match', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).post('/api/requests/match').send({ freeText: 'help' })
    expect(res.status).toBe(401)
  })

  it('400s when freeText is missing (Sibling review finding, G411-63 PR)', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/match').send({})
    expect(res.status).toBe(400)
  })

  it('returns matched types for a signed-in user', async () => {
    currentUserId = OWNER
    const { matchKeywords } = await import('../lib/matchKeywords.js')
    matchKeywords.mockResolvedValue(['TRAVEL'])

    const res = await request(app).post('/api/requests/match').send({ freeText: 'need a flight' })
    expect(res.status).toBe(200)
    expect(res.body.matchedTypes).toEqual(['TRAVEL'])
  })

  // G411-81: same real, once-off DB failure caught live also hit this
  // route (no error handling existed here either — any thrown error
  // crashed with no logged reason).
  it('500s cleanly with a logged reason if matching fails', async () => {
    currentUserId = OWNER
    const { matchKeywords } = await import('../lib/matchKeywords.js')
    matchKeywords.mockRejectedValue(new Error('connection lost'))

    const res = await request(app).post('/api/requests/match').send({ freeText: 'need a flight' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to match request type' })
  })
})

describe('POST /api/requests/:id/messages (G411-24)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })
    expect(res.status).toBe(401)
  })

  it('404s for a signed-in user who is not the owner or an admin', async () => {
    currentUserId = OTHER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })
    expect(res.status).toBe(404)
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('400s when content is missing', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/1/messages').send({})
    expect(res.status).toBe(400)
  })

  it('400s when content is whitespace-only (Sibling review finding)', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/1/messages').send({ content: '   ' })
    expect(res.status).toBe(400)
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('creates a message for the owner and returns 201', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    const created = { id: 5, content: 'hi', imageUrl: null, requestId: 1, userId: OWNER, createdAt: new Date() }
    prismaMock.message.create.mockResolvedValue(created)

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })
    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: 'hi', encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
    })
  })

  it('allows an admin to message a request they do not own', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.message.create.mockResolvedValue({ id: 6, content: 'hi', requestId: 1, userId: ADMIN })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })
    expect(res.status).toBe(201)
  })
})

// G411-34 — reopen-on-message
describe('POST /api/requests/:id/nudge (G411-93)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).post('/api/requests/1/nudge')
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin (not 403 — same info-leak-avoidance convention as the rest of this router)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WAITING_ON_USER', nudgedAt: null })
    const res = await request(app).post('/api/requests/1/nudge')
    expect(res.status).toBe(404)
  })

  it('400s if the request is not WAITING_ON_USER', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT', nudgedAt: null })

    const res = await request(app).post('/api/requests/1/nudge')

    expect(res.status).toBe(400)
  })

  it('400s if the request is already nudged (nudgedAt not null)', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WAITING_ON_USER', nudgedAt: new Date() })

    const res = await request(app).post('/api/requests/1/nudge')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already nudged|once per cycle/)
  })

  it('sends nudge #1 and stamps nudgedAt for a fresh WAITING_ON_USER request', async () => {
    currentUserId = ADMIN
    // First findUnique (route's pre-check) returns status WAITING_ON_USER and nudgedAt null
    // Second findUnique (sendNudge's in-tx read after updateMany) returns full request with messages
    prismaMock.request.findUnique
      .mockResolvedValueOnce({ ...sampleRequest, status: 'WAITING_ON_USER', nudgedAt: null })
      .mockResolvedValueOnce({ ...sampleRequest, nudgedAt: new Date(), message: [] })
    prismaMock.user.findFirst.mockResolvedValue({ clerkId: ADMIN, role: 'ADMIN' })
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    prismaMock.request.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.message.create.mockResolvedValue({ id: 11, requestId: 1, userId: ADMIN, isSystem: true })

    const res = await request(app).post('/api/requests/1/nudge')

    expect(res.status).toBe(201)
  })
})

describe('GET/POST /api/requests/:id/notes (G411-40, admin-only)', () => {
  it('GET 401s when unauthenticated', async () => {
    const res = await request(app).get('/api/requests/1/notes')
    expect(res.status).toBe(401)
  })

  it('GET 404s for a non-admin, even the request owner (same info-leak-avoidance convention as the rest of this router)', async () => {
    currentUserId = OWNER
    const res = await request(app).get('/api/requests/1/notes')
    expect(res.status).toBe(404)
    expect(prismaMock.note.findMany).not.toHaveBeenCalled()
  })

  it('GET 404s when the request does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/requests/999/notes')
    expect(res.status).toBe(404)
  })

  it('GET 200s with the request\'s notes, oldest first, for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({ id: 1 })
    const notes = [{ id: 1, content: 'first', requestId: 1, createdAt: new Date() }]
    prismaMock.note.findMany.mockResolvedValue(notes)

    const res = await request(app).get('/api/requests/1/notes')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(JSON.parse(JSON.stringify(notes)))
    expect(prismaMock.note.findMany).toHaveBeenCalledWith({
      where: { requestId: 1 },
      orderBy: { createdAt: 'asc' },
    })
  })

  it('POST 401s when unauthenticated', async () => {
    const res = await request(app).post('/api/requests/1/notes').send({ content: 'x' })
    expect(res.status).toBe(401)
  })

  it('POST 404s for a non-admin, even the request owner', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/1/notes').send({ content: 'x' })
    expect(res.status).toBe(404)
    expect(prismaMock.note.create).not.toHaveBeenCalled()
  })

  it('POST 400s when content is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).post('/api/requests/1/notes').send({})
    expect(res.status).toBe(400)
  })

  it('POST 400s when content is whitespace-only', async () => {
    currentUserId = ADMIN
    const res = await request(app).post('/api/requests/1/notes').send({ content: '   ' })
    expect(res.status).toBe(400)
    expect(prismaMock.note.create).not.toHaveBeenCalled()
  })

  it('POST 404s when the request does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(null)
    const res = await request(app).post('/api/requests/999/notes').send({ content: 'x' })
    expect(res.status).toBe(404)
  })

  it('POST creates a trimmed note and returns 201 for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.note.create.mockResolvedValue({ id: 2, content: 'noted', requestId: 1 })

    const res = await request(app).post('/api/requests/1/notes').send({ content: '  noted  ' })

    expect(res.status).toBe(201)
    expect(prismaMock.note.create).toHaveBeenCalledWith({
      data: { content: 'noted', requestId: 1 },
    })
  })
})

describe('POST /api/requests/:id/messages — reopen-on-message (G411-34)', () => {
  it('a friend message on a CLOSED request reopens it to IN_QUEUE', async () => {
    currentUserId = OWNER
    // G411-90: mock must include refundedAt (null for CLOSED, which was never refundable)
    // G411-93: also include nudgedAt and nudgeTwoSentAt (cleared when friend replies on reopenable)
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'CLOSED', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 7, content: 'still need help', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'still need help' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
  })

  it('an admin message on a CLOSED request reopens it to WAITING_ON_USER', async () => {
    currentUserId = ADMIN
    // G411-90: mock must include refundedAt (null for CLOSED)
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'CLOSED', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 8, content: 'one more thing', requestId: 1, userId: ADMIN })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'one more thing' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'WAITING_ON_USER' },
    })
  })

  it('a message on a non-reopenable request does not change status but clears nudgedAt and nudgeTwoSentAt if friend messaged (G411-93)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT' })
    prismaMock.message.create.mockResolvedValue({ id: 9, content: 'update', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'update' })

    expect(res.status).toBe(201)
    // Status should not change, but nudgedAt and nudgeTwoSentAt are cleared by friend message (G411-93)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nudgedAt: null, nudgeTwoSentAt: null },
    })
  })

  it('does not double-reopen if the request was already reopened by the time the transaction re-checks (Sibling review race fix)', async () => {
    currentUserId = OWNER
    // Pre-transaction read sees CLOSED (stale); the in-tx fresh re-read
    // sees it's already been reopened by a concurrent write — the second
    // reopen must not fire.
    // G411-90: both mocks must include refundedAt field
    prismaMock.request.findUnique
      .mockResolvedValueOnce({ ...sampleRequest, status: 'CLOSED', refundedAt: null })
      .mockResolvedValueOnce({ status: 'WAITING_ON_USER', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 10, content: 'hi again', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi again' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('a friend message on a reopenable request (CLOSED/CANCELLED/SELF_SOLVED) that had nudgedAt set clears it (G411-93)', async () => {
    // When a friend reopens a request that was previously in an
    // escalation cycle (nudgedAt was set), the reply should clear
    // nudgedAt to reset the cycle, same as replying to non-reopenable.
    currentUserId = OWNER
    const nudgedAt = new Date(Date.now() - 3 * DAY_MS)
    prismaMock.request.findUnique
      .mockResolvedValueOnce({ ...sampleRequest, status: 'CLOSED', refundedAt: null, nudgedAt })
      .mockResolvedValueOnce({ status: 'CLOSED', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 11, content: 'need to reopen', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'need to reopen' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
  })
})

// G411-90 — reopen and recharge when refundedAt is set
describe('POST /api/requests/:id/messages — reopen with refund recharge (G411-90)', () => {
  it('reopens a CANCELLED request and charges 1 credit when it was refunded (refundedAt is set)', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: now,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 20, content: 'come back', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'come back' })

    expect(res.status).toBe(201)
    // Verify the update was called with status, refundedAt, and nudge fields cleared
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null },
    })
    // Verify credit was deducted
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: OWNER },
      data: { creditBalance: { decrement: 1 } },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })

  it('reopens a SELF_SOLVED request and charges 1 credit when it was refunded', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'SELF_SOLVED',
      refundedAt: now,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 21, content: 'update', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'update' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })

  it('reopens a CANCELLED request WITHOUT charging when it was NOT refunded (refundedAt is null)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: null, // not refunded because admin had messaged
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 22, content: 'nevermind', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'nevermind' })

    expect(res.status).toBe(201)
    // Status changes, nudge fields cleared, no refundedAt update (it's already null)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
    // No credit deduction happened
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('reopens a CLOSED request and does NOT charge (CLOSED was never refundable, refundedAt stays null)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CLOSED',
      refundedAt: null,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 23, content: 'back to this', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'back to this' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('402s when reopening would charge but balance is 0 (insufficient funds)', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'SELF_SOLVED',
      refundedAt: now,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({ id: 24, content: 'try again', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'try again' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('Insufficient credit balance')
    // Verify the status and refundedAt were NOT changed (transaction rolled back)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('admin message on refunded CANCELLED reopens to WAITING_ON_USER and charges 1 credit', async () => {
    currentUserId = ADMIN
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: now,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({ id: 25, content: 'hi', requestId: 1, userId: ADMIN })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 2 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })

    expect(res.status).toBe(201)
    // Admin reopens to WAITING_ON_USER
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'WAITING_ON_USER', refundedAt: null },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })
})

describe('POST /api/requests/:id/messages — encrypted flag (G411-82)', () => {
  // Decision #98 pause: E2E_ENABLED=false, so this route now forces
  // encrypted: false regardless of what the client sends — see
  // e2eConfig.js. The client itself no longer sends encrypted:'true'
  // either (RequestDetail.jsx), but this is the structural backstop.
  it('forces encrypted: false even when the client sends encrypted="true" (E2E paused)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    const envelope = JSON.stringify({ iv: 'abc', ciphertext: 'def' })
    prismaMock.message.create.mockResolvedValue({ id: 9, content: envelope, encrypted: false })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: envelope, encrypted: 'true' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: envelope, encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
    })
  })

  it('defaults encrypted: false for a plain send (no flag, legacy behavior unchanged)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.message.create.mockResolvedValue({ id: 10, content: 'hi' })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: 'hi', encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
    })
  })

  // Was a 400 pre-pause (a keyless sender can't have produced a real
  // envelope). With E2E_ENABLED=false the isEncrypted precondition never
  // even evaluates true, so a keyless sender's "encrypted" send just
  // lands as an ordinary plaintext message instead of being rejected.
  it('accepts a send from a keyless sender as plaintext (E2E paused, no key precondition)', async () => {
    currentUserId = OTHER // OTHER has a publicKey in this fixture — swap it out for this test
    const noKeyUser = { ...usersByClerkId[OTHER], publicKey: null }
    usersByClerkId[OTHER] = noKeyUser
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, userId: OTHER })
    prismaMock.message.create.mockResolvedValue({ id: 11, content: 'hi', encrypted: false })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: JSON.stringify({ iv: 'a', ciphertext: 'b' }), encrypted: 'true' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        content: JSON.stringify({ iv: 'a', ciphertext: 'b' }),
        encrypted: false,
        imageUrl: null,
        requestId: 1,
        userId: OTHER,
      },
    })
    usersByClerkId[OTHER] = { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' } // restore
  })

  // Sibling review finding (second round): the encrypted/publicKey check
  // used to run BEFORE the ownership check, so a non-owner sending
  // encrypted:true got a 400 about their own key status instead of this
  // router's deliberate 404 "Request not found" — leaking that the
  // encrypted-flag path exists (and their own key status) to someone who
  // shouldn't even be able to confirm the request exists.
  it('404s (not 400) for a non-owner, non-admin sender with no public key trying to send encrypted content', async () => {
    currentUserId = OTHER
    const noKeyUser = { ...usersByClerkId[OTHER], publicKey: null }
    usersByClerkId[OTHER] = noKeyUser
    // OWNER (not OTHER) owns this request — OTHER is a real signed-in
    // user, just not the owner and not an admin.
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, userId: OWNER })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: JSON.stringify({ iv: 'a', ciphertext: 'b' }), encrypted: 'true' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Request not found' })
    expect(prismaMock.message.create).not.toHaveBeenCalled()
    usersByClerkId[OTHER] = { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' } // restore
  })
})

describe('GET /api/requests/:id/public-keys (G411-82)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).get('/api/requests/1/public-keys')
    expect(res.status).toBe(401)
  })

  it('400s on a non-numeric id', async () => {
    currentUserId = OWNER
    const res = await request(app).get('/api/requests/not-a-number/public-keys')
    expect(res.status).toBe(400)
  })

  it('404s when the request does not exist', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/requests/999/public-keys')
    expect(res.status).toBe(404)
  })

  it('404s for a signed-in user who is neither the owner nor an admin', async () => {
    currentUserId = OTHER
    prismaMock.request.findUnique.mockResolvedValue({ userId: OWNER })
    const res = await request(app).get('/api/requests/1/public-keys')
    expect(res.status).toBe(404)
  })

  it('owner gets their own key as "me" and any admin\'s key as "other"', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ userId: OWNER })
    prismaMock.user.findFirst.mockResolvedValue({ publicKey: 'admin-pubkey' })

    const res = await request(app).get('/api/requests/1/public-keys')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ me: 'owner-pubkey', other: 'admin-pubkey' })
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { publicKey: true },
    })
  })

  it('admin gets their own key as "me" and the request owner\'s key as "other"', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({ userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ publicKey: 'owner-pubkey' })

    const res = await request(app).get('/api/requests/1/public-keys')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ me: 'admin-pubkey', other: 'owner-pubkey' })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { clerkId: OWNER },
      select: { publicKey: true },
    })
  })

  it('returns other: null when that party has no public key yet, not an error', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ userId: OWNER })
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await request(app).get('/api/requests/1/public-keys')
    expect(res.status).toBe(200)
    expect(res.body.other).toBeNull()
  })
})

describe('POST /api/requests/:id/messages — image upload (G411-26)', () => {
  it('accepts an image with no caption (photo alone is a valid message)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    uploadImageMock.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg' })
    prismaMock.message.create.mockResolvedValue({ id: 7, content: '', imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg' })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(uploadImageMock).toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: '', encrypted: false, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg', requestId: 1, userId: OWNER },
    })
  })

  it('accepts an image with a caption together (one message, both fields)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    uploadImageMock.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x/image/upload/v1/z.jpg' })
    prismaMock.message.create.mockResolvedValue({ id: 8 })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .field('content', 'here is a photo')
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: 'here is a photo', encrypted: false, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/z.jpg', requestId: 1, userId: OWNER },
    })
  })

  it('400s on a disallowed file type, never calls Cloudinary', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('400s on an oversized image, never calls Cloudinary', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1)

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('400s when neither content nor an image is sent', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/1/messages').send({})
    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/requests/users (G411-44, admin dropdown)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).get('/api/requests/users')
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = OWNER
    const res = await request(app).get('/api/requests/users')
    expect(res.status).toBe(404)
  })

  it('returns a sorted list of users for an admin', async () => {
    currentUserId = ADMIN
    const mockUsers = [
      { clerkId: 'alice', firstName: 'Alice', lastName: 'Smith' },
      { clerkId: 'bob', firstName: 'Bob', lastName: 'Jones' },
    ]
    prismaMock.user.findMany.mockResolvedValue(mockUsers)

    const res = await request(app).get('/api/requests/users')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(mockUsers)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: { not: 'ADMIN' } },
      select: { clerkId: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
  })
})

describe('POST /api/requests/admin-create (G411-44)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = OWNER
    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help' })
    expect(res.status).toBe(404)
  })

  it('400s when userId is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ freeText: 'help' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/userId/i)
  })

  it('400s when freeText is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/freeText/i)
  })

  it('404s when the target user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: 'nonexistent', freeText: 'help' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
  })

  it('400s when the target user IS the admin (Sibling review finding — self-target was unguarded)', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: ADMIN, role: 'ADMIN' })

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: ADMIN, freeText: 'help' })

    expect(res.status).toBe(400)
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('does not charge a credit when chargeCredit is a truthy non-boolean (e.g. the string "false")', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER' })
    prismaMock.request.create.mockResolvedValue({
      id: 8,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const credits = await import('../lib/credits.js')
    const deductSpy = vi.spyOn(credits, 'deductCredit')

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: 'false' })

    expect(res.status).toBe(201)
    expect(deductSpy).not.toHaveBeenCalled()
    deductSpy.mockRestore()
  })

  it('creates a request for the selected user, not the admin', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER' })
    prismaMock.request.create.mockResolvedValue({
      id: 5,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help' })

    expect(res.status).toBe(201)
    expect(res.body.userId).toBe(OTHER)
    // Verify the request.create was called with the OTHER user's ID, not ADMIN's
    expect(prismaMock.request.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: OTHER }),
      })
    )
  })

  it('does NOT call deductCredit when chargeCredit is false', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER' })
    prismaMock.request.create.mockResolvedValue({
      id: 6,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const credits = await import('../lib/credits.js')
    const deductSpy = vi.spyOn(credits, 'deductCredit')

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: false })

    expect(res.status).toBe(201)
    expect(deductSpy).not.toHaveBeenCalled()
    deductSpy.mockRestore()
  })

  it('calls deductCredit when chargeCredit is true', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER', creditBalance: 5 })
    prismaMock.request.create.mockResolvedValue({
      id: 7,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const credits = await import('../lib/credits.js')
    const deductSpy = vi.spyOn(credits, 'deductCredit')

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: true })

    expect(res.status).toBe(201)
    expect(deductSpy).toHaveBeenCalledWith(expect.anything(), OTHER)
    deductSpy.mockRestore()
  })

  it('returns 402 when the target user has insufficient balance and chargeCredit is true', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER', creditBalance: 0 })

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: true })

    expect(res.status).toBe(402)
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('calls sendPushToUser after successful creation', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER' })
    prismaMock.request.create.mockResolvedValue({
      id: 8,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const { sendPushToUser } = await import('../lib/webPush.js')

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: false })

    expect(res.status).toBe(201)
    expect(sendPushToUser).toHaveBeenCalledWith(
      OTHER,
      expect.objectContaining({
        title: 'New request opened for you',
        body: expect.stringContaining('Gavi opened'),
      })
    )
  })

  it('still returns 201 even if sendPushToUser fails', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ clerkId: OTHER, role: 'USER' })
    prismaMock.request.create.mockResolvedValue({
      id: 9,
      userId: OTHER,
      freeText: 'help',
      type: null,
      status: 'IN_QUEUE',
    })

    const { sendPushToUser } = await import('../lib/webPush.js')
    sendPushToUser.mockRejectedValue(new Error('Push service down'))

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: false })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(9)
  })
})

describe('PATCH /api/requests/users/:userId/group-tag (G411-46)', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/requests/users/user_1/group-tag').send({ groupTag: 'REGULAR' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin user', async () => {
    currentUserId = OTHER
    const res = await request(app).patch('/api/requests/users/user_1/group-tag').send({ groupTag: 'REGULAR' })
    expect(res.status).toBe(404)
  })

  it('400s when groupTag is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/group-tag').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('groupTag')
  })

  it('400s when groupTag is an invalid value', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/group-tag').send({ groupTag: 'INVALID' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('LIMITED')
  })

  it('updates the user\'s groupTag and applies the upgrade delta to creditBalance', async () => {
    currentUserId = ADMIN
    // Regular(5) -> Close(7), balance 4 (used 1) -> delta +2 -> 6.
    prismaMock.user.findUnique.mockResolvedValue({ groupTag: 'REGULAR', creditBalance: 4 })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, groupTag: 'CLOSE', creditBalance: 6 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/group-tag')
      .send({ groupTag: 'CLOSE' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ clerkId: OTHER, groupTag: 'CLOSE', creditBalance: 6 })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { groupTag: 'CLOSE', creditBalance: { increment: 2 } },
      select: { clerkId: true, groupTag: true, creditBalance: true },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 2, userId: 'user_other' },
    })
  })

  it('downgrade clamps balance down to the new cap only if currently above it', async () => {
    currentUserId = ADMIN
    // Regular(5) -> Limited(2), balance 3 (above the new cap) -> clamp to 2.
    prismaMock.user.findUnique.mockResolvedValue({ groupTag: 'REGULAR', creditBalance: 3 })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, groupTag: 'LIMITED', creditBalance: 2 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/group-tag')
      .send({ groupTag: 'LIMITED' })

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { groupTag: 'LIMITED', creditBalance: { increment: -1 } },
      select: { clerkId: true, groupTag: true, creditBalance: true },
    })
  })

  it('downgrade leaves balance untouched, no CreditTransaction, when already below the new cap', async () => {
    currentUserId = ADMIN
    // Regular(5) -> Limited(2), balance 1 (already below the new cap) -> no change.
    prismaMock.user.findUnique.mockResolvedValue({ groupTag: 'REGULAR', creditBalance: 1 })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, groupTag: 'LIMITED', creditBalance: 1 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/group-tag')
      .send({ groupTag: 'LIMITED' })

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { groupTag: 'LIMITED', creditBalance: { increment: 0 } },
      select: { clerkId: true, groupTag: true, creditBalance: true },
    })
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('404s when the user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/requests/users/nonexistent/group-tag')
      .send({ groupTag: 'LIMITED' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
  })

  it('404s when the target is an ADMIN (Sibling review finding — GET /users excludes ADMIN client-side for this exact reason, PATCH did not enforce it server-side)', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN', groupTag: 'REGULAR', creditBalance: 5 })

    const res = await request(app)
      .patch('/api/requests/users/user_1/group-tag')
      .send({ groupTag: 'CLOSE' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('500s on an unexpected database error', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockRejectedValue(new Error('DB connection lost'))

    const res = await request(app)
      .patch('/api/requests/users/user_1/group-tag')
      .send({ groupTag: 'REGULAR' })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('Failed to update')
  })
})

describe('stripEmpty (G411-74 Sibling review finding)', () => {
  it('drops a nested object whose fields are all empty, not just top-level empties', async () => {
    // TravelFields' new hotel/car objects (G411-74) — an all-blank toggled-on
    // panel used to survive as junk since stripEmpty only recursed into arrays.
    const { stripEmpty } = await import('./requests.js')
    expect(stripEmpty({ hotel: { date: '', location: '', company: '', ref: '' }, car: null, destination: 'Paris' }))
      .toEqual({ destination: 'Paris' })
  })

  it('keeps a nested object but strips only its empty fields', async () => {
    const { stripEmpty } = await import('./requests.js')
    expect(stripEmpty({ hotel: { date: 'Sep 1', location: '', company: '', ref: '' } }))
      .toEqual({ hotel: { date: 'Sep 1' } })
  })
})
