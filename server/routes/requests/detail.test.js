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

vi.mock('../../middleware/auth.js', () => ({
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

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../../lib/matchKeywords.js', () => ({ matchKeywords: vi.fn() }))

const uploadImageMock = vi.fn()
vi.mock('../../lib/cloudinary.js', async () => {
  const actual = await vi.importActual('../../lib/cloudinary.js')
  return { ...actual, uploadImage: (...args) => uploadImageMock(...args) }
})

// Real implementation by default (it operates on prismaMock as its `tx`
// arg, so existing tests asserting user.update/creditTransaction.create
// side effects still pass) — G411-44's tests spy on it per-test instead
// of replacing it wholesale, which broke every pre-existing deduction/
// refund assertion in this file (Sibling review finding).
vi.mock('../../lib/credits.js', async () => {
  const actual = await vi.importActual('../../lib/credits.js')
  return { ...actual }
})

vi.mock('../../lib/webPush.js', () => ({
  sendPushToUser: vi.fn(async () => undefined),
}))

vi.mock('../../lib/notify.js', () => ({
  notifyAdmins: vi.fn(async () => undefined),
  notifyUser: vi.fn(async () => undefined),
}))

const { default: requestsRouter } = await import('./index.js')

const app = express()
app.use(express.json())
app.use('/api/requests', requestsRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
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

  // G411-47 — an overdraft request never had a credit charged, so it must
  // never refund one at any later exit either (would create free credits).
  // Paired against the identical, otherwise-untouched CANCELLED-refund test
  // above (line ~496) to prove the ONLY difference is isOverdraft.
  describe('overdraft requests never refund (G411-47)', () => {
    it('does NOT refund an overdraft-approved request on CANCELLED, even fully untouched', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, isOverdraft: true })
      prismaMock.message.findFirst.mockResolvedValue(null) // untouched — would refund if NOT overdraft
      prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, isOverdraft: true, status: 'CANCELLED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CANCELLED' },
        include: { message: { orderBy: { createdAt: 'asc' } } },
      })
    })

    it('contrast: an otherwise-identical non-overdraft request DOES refund on the same CANCELLED exit', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, isOverdraft: false })
      prismaMock.message.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, isOverdraft: false, status: 'CANCELLED' })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
        data: { amount: 1, userId: OWNER },
      })
    })
  })

  // G411-47 — OVERDRAFT_PENDING transitions are admin-only
  describe('overdraft approve/deny transitions are admin-only (G411-47)', () => {
    it('allows an admin to approve (OVERDRAFT_PENDING -> IN_QUEUE)', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_PENDING', isOverdraft: true })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'IN_QUEUE', isOverdraft: true })

      const res = await request(app).patch('/api/requests/1').send({ status: 'IN_QUEUE' })
      expect(res.status).toBe(200)
    })

    it('allows an admin to deny (OVERDRAFT_PENDING -> OVERDRAFT_DENIED)', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_PENDING', isOverdraft: true })
      prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_DENIED', isOverdraft: true })

      const res = await request(app).patch('/api/requests/1').send({ status: 'OVERDRAFT_DENIED' })
      expect(res.status).toBe(200)
    })

    it('blocks the owning friend from self-approving their own overdraft request', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_PENDING', isOverdraft: true })

      const res = await request(app).patch('/api/requests/1').send({ status: 'IN_QUEUE' })
      expect(res.status).toBe(400)
      expect(prismaMock.request.update).not.toHaveBeenCalled()
    })

    it('blocks the owning friend from self-denying their own overdraft request', async () => {
      currentUserId = OWNER
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_PENDING', isOverdraft: true })

      const res = await request(app).patch('/api/requests/1').send({ status: 'OVERDRAFT_DENIED' })
      expect(res.status).toBe(400)
      expect(prismaMock.request.update).not.toHaveBeenCalled()
    })

    it('rejects any other transition out of OVERDRAFT_PENDING (invalid, same as any bad TRANSITIONS edge)', async () => {
      currentUserId = ADMIN
      prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'OVERDRAFT_PENDING', isOverdraft: true })

      const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })
      expect(res.status).toBe(400)
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

