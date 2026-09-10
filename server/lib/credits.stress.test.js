// Stress test suite for credit charge/refund/recharge lifecycle (G411-97).
// Tests route-level behavior via supertest against the requests router,
// with fully-mocked Prisma (same pattern as requests.test.js).
//
// Five scenarios:
// 1. Multi-cycle refund/reopen lifecycle (same request, two full cycles)
// 2. Concurrency: fresh state reads inside transactions prevent double-reopens
// 3. Insufficient-balance edges (create fails at 0, reopen 500s and rolls back)
// 4. Ledger-vs-balance drift check (10+ alternating deduct/refund calls)
// 5. Admin-on-behalf-of-friend with correct userId targets

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const OWNER = 'user_owner'
const OTHER = 'user_other'
const ADMIN = 'user_admin'

let currentUserId = null

const usersByClerkId = {
  [OWNER]: { clerkId: OWNER, role: 'USER', publicKey: 'owner-pubkey' },
  [OTHER]: { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN', publicKey: 'admin-pubkey' },
}

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
  refundedAt: null,
  nudgedAt: null,
  nudgeTwoSentAt: null,
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
  $transaction: vi.fn((cb) => cb(prismaMock)),
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../lib/matchKeywords.js', () => ({ matchKeywords: vi.fn() }))

const uploadImageMock = vi.fn()
vi.mock('../lib/cloudinary.js', async () => {
  const actual = await vi.importActual('../lib/cloudinary.js')
  return { ...actual, uploadImage: (...args) => uploadImageMock(...args) }
})

vi.mock('../lib/credits.js', async () => {
  const actual = await vi.importActual('../lib/credits.js')
  return { ...actual }
})

vi.mock('../lib/webPush.js', () => ({
  sendPushToUser: vi.fn(async () => undefined),
}))

const { default: requestsRouter } = await import('../routes/requests.js')

const app = express()
app.use(express.json())
app.use('/api/requests', requestsRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

// ============================================================================
// Scenario 1: Multi-cycle lifecycle (create → refund-exit → reopen → repeat)
// ============================================================================
describe('1. Multi-cycle refund/recharge lifecycle', () => {
  it('cycles through two complete refund→reopen sequences on the same request', async () => {
    currentUserId = OWNER
    const requestId = 1

    // ===== CYCLE 1 =====
    // Step 1: Create request (charge 1 credit)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 5 })
    prismaMock.request.create.mockResolvedValue({
      id: requestId,
      ...sampleRequest,
    })

    let res = await request(app).post('/api/requests').send({ freeText: 'first help' })
    expect(res.status).toBe(201)
    const deductCalls = prismaMock.creditTransaction.create.mock.calls.filter(
      (c) => c[0].data.amount === -1 && c[0].data.userId === OWNER
    )
    expect(deductCalls.length).toBeGreaterThanOrEqual(1)

    // Step 2: Refund via PATCH to CANCELLED (no admin message)
    vi.clearAllMocks()
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.message.findFirst.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 4 })
    prismaMock.request.update.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: new Date(),
      message: [],
    })

    res = await request(app).patch(`/api/requests/${requestId}`).send({ status: 'CANCELLED' })
    expect(res.status).toBe(200)
    // Verify refund happened
    const refundCall = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.amount === 1 && c[0].data.userId === OWNER
    )
    expect(refundCall).toBeDefined()
    // Verify refundedAt was set
    expect(prismaMock.request.update.mock.calls.some((c) => c[0].data.refundedAt)).toBe(true)

    // Step 3: Reopen via POST message on CANCELLED request (charges 1 credit again)
    vi.clearAllMocks()
    const refundedDate = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: refundedDate,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({
      id: 10,
      content: 'come back',
      requestId,
      userId: OWNER,
    })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 5 })

    res = await request(app).post(`/api/requests/${requestId}/messages`).send({ content: 'come back' })
    expect(res.status).toBe(201)
    // Verify deductCredit was called for reopen
    const reopenDeductCall = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.amount === -1 && c[0].data.userId === OWNER
    )
    expect(reopenDeductCall).toBeDefined()
    // Verify refundedAt cleared
    expect(
      prismaMock.request.update.mock.calls.some((c) => c[0].data.refundedAt === null)
    ).toBe(true)

    // ===== CYCLE 2 =====
    // Step 4: Refund again (PATCH to CANCELLED from IN_QUEUE)
    vi.clearAllMocks()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'IN_QUEUE',
      refundedAt: null,
    })
    prismaMock.message.findFirst.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 4 })
    prismaMock.request.update.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: new Date(),
      message: [],
    })

    res = await request(app).patch(`/api/requests/${requestId}`).send({ status: 'CANCELLED' })
    expect(res.status).toBe(200)
    // Verify second refund happened
    const secondRefund = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.amount === 1 && c[0].data.userId === OWNER
    )
    expect(secondRefund).toBeDefined()
    expect(prismaMock.request.update.mock.calls.some((c) => c[0].data.refundedAt)).toBe(true)

    // Step 5: Reopen again on CANCELLED (second time)
    vi.clearAllMocks()
    const secondRefundedDate = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: secondRefundedDate,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({
      id: 11,
      content: 'actually need help again',
      requestId,
      userId: OWNER,
    })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 5 })

    res = await request(app)
      .post(`/api/requests/${requestId}/messages`)
      .send({ content: 'actually need help again' })
    expect(res.status).toBe(201)
    // Verify second reopen deduction
    const secondReopenDeduct = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.amount === -1 && c[0].data.userId === OWNER
    )
    expect(secondReopenDeduct).toBeDefined()
    // Verify refundedAt cleared
    expect(
      prismaMock.request.update.mock.calls.some((c) => c[0].data.refundedAt === null)
    ).toBe(true)
  })
})

// ============================================================================
// Scenario 2: Concurrency — fresh state reads prevent double-reopens
// ============================================================================
describe('2. Concurrency: fresh state reads inside transactions', () => {
  it('does not double-reopen when fresh state differs from pre-transaction snapshot', async () => {
    // This test proves the code reads fresh.status INSIDE the transaction
    // rather than trusting the pre-transaction existing.status. Real concurrent
    // transaction serialization is provided by Postgres in production and is
    // NOT reproduced by mocks; this test only verifies the app-code pattern
    // (fresh read inside tx) that enables Postgres's serialization to work.
    currentUserId = OWNER
    const requestId = 1

    // Pre-transaction read: request is CANCELLED (reopenable)
    prismaMock.request.findUnique.mockResolvedValueOnce({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: null,
      userId: OWNER,
    })

    // Message.create succeeds in the transaction
    prismaMock.message.create.mockResolvedValueOnce({
      id: 20,
      content: 'reopen attempt',
      requestId,
      userId: OWNER,
    })

    // Fresh read INSIDE transaction sees the request was already reopened by
    // a concurrent write — status is now IN_QUEUE (no longer CANCELLED)
    prismaMock.request.findUnique.mockResolvedValueOnce({
      status: 'IN_QUEUE',
      refundedAt: null,
    })

    // Since fresh.status is IN_QUEUE (not in REOPENABLE_STATUSES), the reopen
    // update should NOT fire — request.update should not be called
    const res = await request(app)
      .post(`/api/requests/${requestId}/messages`)
      .send({ content: 'reopen attempt' })

    expect(res.status).toBe(201)
    // Verify request.update was NOT called (because fresh status wasn't reopenable)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('calls deductCredit at most once per completed message transaction', async () => {
    // Verify that even though deductCredit is called conditionally inside
    // the transaction, it's only called once (not double-called on any code path)
    currentUserId = OWNER
    const requestId = 2

    prismaMock.request.findUnique.mockResolvedValueOnce({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: new Date(),
      userId: OWNER,
    })

    prismaMock.message.create.mockResolvedValueOnce({
      id: 21,
      content: 'hi',
      requestId,
      userId: OWNER,
    })

    prismaMock.user.findUnique.mockResolvedValueOnce({ creditBalance: 3 })

    prismaMock.request.findUnique.mockResolvedValueOnce({
      status: 'CANCELLED',
      refundedAt: new Date(),
    })

    prismaMock.request.update.mockResolvedValueOnce({
      status: 'IN_QUEUE',
      refundedAt: null,
    })

    const res = await request(app).post(`/api/requests/${requestId}/messages`).send({ content: 'hi' })

    expect(res.status).toBe(201)
    // Count how many times creditTransaction.create was called with amount: -1
    // (deductCredit calls it once per deduction)
    const deductCalls = prismaMock.creditTransaction.create.mock.calls.filter(
      (call) => call[0].data.amount === -1 && call[0].data.userId === OWNER
    )
    expect(deductCalls.length).toBe(1)
  })
})

// ============================================================================
// Scenario 3: Insufficient-balance edges
// ============================================================================
describe('3. Insufficient-balance edges', () => {
  it('402s and creates nothing when POST / at balance 0', async () => {
    currentUserId = OWNER
    vi.clearAllMocks()

    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0 })

    const res = await request(app).post('/api/requests').send({ freeText: 'help' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('Insufficient credit balance')
    // Verify request.create was never called
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('402s and does not mutate when reopen charges but balance is 0', async () => {
    currentUserId = OWNER
    const requestId = 3
    vi.clearAllMocks()

    // Pre-transaction read: request is refunded and reopenable
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'SELF_SOLVED',
      refundedAt: new Date(),
      userId: OWNER,
    })

    // Message.create succeeds
    prismaMock.message.create.mockResolvedValue({
      id: 22,
      content: 'try again',
      requestId,
      userId: OWNER,
    })

    // User has 0 balance (can't recharge)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0 })

    const res = await request(app)
      .post(`/api/requests/${requestId}/messages`)
      .send({ content: 'try again' })

    // deductCredit throws 402, which bubbles via the catch block (line 878-883)
    // that checks err.statusCode and returns it
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('Insufficient credit balance')
    // Verify request.update was NOT called (transaction rolled back on deductCredit throw)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Scenario 4: Ledger-vs-balance drift check
// ============================================================================
describe('4. Ledger-vs-balance drift check (10+ deduct/refund cycles)', () => {
  it('tracks credit amounts through 10 alternating deduct/refund calls and verifies ledger balance', async () => {
    // Import the real lib/credits.js functions (they're mocked to return the actual implementation)
    const { deductCredit, refundCredit } = await import('./credits.js')

    // Reset mocks to track all creditTransaction.create calls in this test
    vi.clearAllMocks()

    // Set up a fresh mock for this test that tracks the mock tx
    const mockTx = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      creditTransaction: {
        create: vi.fn(),
      },
    }

    const userId = OWNER
    let currentBalance = 10 // Start with 10 credits

    // Track all amounts written to creditTransaction
    const amounts = []

    // Simulate 10 alternating deduct/refund calls
    for (let i = 0; i < 5; i++) {
      // Deduct
      mockTx.user.findUnique.mockResolvedValueOnce({ creditBalance: currentBalance })
      mockTx.user.update.mockResolvedValueOnce({ creditBalance: currentBalance - 1 })
      mockTx.creditTransaction.create.mockImplementation((data) => {
        amounts.push(data.data.amount)
      })

      await deductCredit(mockTx, userId)
      currentBalance -= 1

      // Refund
      mockTx.user.findUnique.mockResolvedValueOnce({ creditBalance: currentBalance })
      mockTx.user.update.mockResolvedValueOnce({ creditBalance: currentBalance + 1 })
      mockTx.creditTransaction.create.mockImplementation((data) => {
        amounts.push(data.data.amount)
      })

      await refundCredit(mockTx, userId)
      currentBalance += 1
    }

    // Verify we have 10 transaction records (5 deducts + 5 refunds)
    expect(amounts.length).toBe(10)

    // Calculate net: sum of all amounts should be 0 (equal deducts and refunds)
    const netAmount = amounts.reduce((sum, amt) => sum + amt, 0)
    expect(netAmount).toBe(0)

    // Verify the pattern: -1, +1, -1, +1, ... (alternating)
    for (let i = 0; i < amounts.length; i++) {
      if (i % 2 === 0) {
        expect(amounts[i]).toBe(-1) // Even indices: deduct
      } else {
        expect(amounts[i]).toBe(1) // Odd indices: refund
      }
    }

    // Verify user.update was called the correct number of times, AND that
    // each call's actual creditBalance mutation (decrement/increment) matches
    // the sign of the ledger amount recorded at that same index — this is
    // the real drift check: a bug that flips decrement<->increment while
    // leaving the ledger row's amount alone (balance silently diverges from
    // its own audit trail) would pass every assertion above but fail here.
    expect(mockTx.user.update.mock.calls.length).toBe(10)
    mockTx.user.update.mock.calls.forEach((call, i) => {
      const mutation = call[0].data.creditBalance
      if (amounts[i] === -1) {
        expect(mutation).toEqual({ decrement: 1 })
      } else {
        expect(mutation).toEqual({ increment: 1 })
      }
    })
  })
})

// ============================================================================
// Scenario 5: Admin-on-behalf-of-friend with correct userId targets
// ============================================================================
describe('5. Admin-on-behalf-of-friend credit operations', () => {
  it('POST /admin-create charges the target FRIEND, not the admin', async () => {
    currentUserId = ADMIN
    vi.clearAllMocks()

    // Admin selects OWNER (a friend) as the target
    prismaMock.user.findUnique.mockResolvedValue({
      clerkId: OWNER,
      role: 'USER',
    })

    // Create request with chargeCredit: true (deduct from OWNER, not ADMIN)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 5 })
    prismaMock.request.create.mockResolvedValue({
      id: 100,
      userId: OWNER,
      freeText: 'admin creates for friend',
    })

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({
        userId: OWNER,
        freeText: 'admin creates for friend',
        chargeCredit: true,
      })

    expect(res.status).toBe(201)
    // Verify deductCredit was called with OWNER's userId, not ADMIN's
    const deductCall = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.userId === OWNER
    )
    expect(deductCall).toBeDefined()
    const updateCall = prismaMock.user.update.mock.calls.find((c) => c[0].where.clerkId === OWNER)
    expect(updateCall).toBeDefined()
  })

  it('admin message on refunded request charges the REQUEST OWNER, not the admin', async () => {
    currentUserId = ADMIN
    const requestId = 101
    const friendUserId = OTHER
    vi.clearAllMocks()

    prismaMock.request.findUnique.mockResolvedValue({
      id: requestId,
      status: 'CANCELLED',
      refundedAt: new Date(),
      userId: friendUserId,
    })

    prismaMock.message.create.mockResolvedValue({
      id: 50,
      content: 'admin reply',
      requestId,
      userId: ADMIN,
    })

    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

    const res = await request(app)
      .post(`/api/requests/${requestId}/messages`)
      .send({ content: 'admin reply' })

    expect(res.status).toBe(201)
    // Verify deductCredit was called with OTHER (the request owner), not ADMIN
    const deductCall = prismaMock.creditTransaction.create.mock.calls.find(
      (c) => c[0].data.userId === friendUserId
    )
    expect(deductCall).toBeDefined()
    const updateCall = prismaMock.user.update.mock.calls.find(
      (c) => c[0].where.clerkId === friendUserId
    )
    expect(updateCall).toBeDefined()
  })

  it('400s when admin tries to admin-create for themselves', async () => {
    currentUserId = ADMIN
    vi.clearAllMocks()

    // Attempt to create for ADMIN (self)
    const adminTargetUser = { clerkId: ADMIN, role: 'ADMIN' }
    prismaMock.user.findUnique.mockResolvedValue(adminTargetUser)

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({
        userId: ADMIN,
        freeText: 'self-target',
        chargeCredit: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Cannot create a request on behalf of an admin/)
    // Verify request.create was never called
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })
})
