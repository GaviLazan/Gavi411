// Route tests for admin user operations. Mocks Prisma and auth —
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
// side effects still pass).
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
describe('GET /api/requests/users (admin dropdown)', () => {
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
      { clerkId: 'alice', firstName: 'Alice', lastName: 'Smith', phoneNumber: '+972501234567', groupTag: 'REGULAR', creditBalance: 5, isDeleted: false, isBlocked: false },
      { clerkId: 'bob', firstName: 'Bob', lastName: 'Jones', phoneNumber: '+972507654321', groupTag: 'CLOSE', creditBalance: 7, isDeleted: false, isBlocked: false },
    ]
    prismaMock.user.findMany.mockResolvedValue(mockUsers)

    const res = await request(app).get('/api/requests/users')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(mockUsers)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
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
  })
})

describe('POST /api/requests/admin-create', () => {
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

  it('400s when the target user IS the admin', async () => {
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

    const credits = await import('../../lib/credits.js')
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

    const credits = await import('../../lib/credits.js')
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

    const credits = await import('../../lib/credits.js')
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

    const { sendPushToUser } = await import('../../lib/webPush.js')

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

    const { sendPushToUser } = await import('../../lib/webPush.js')
    sendPushToUser.mockRejectedValue(new Error('Push service down'))

    const res = await request(app)
      .post('/api/requests/admin-create')
      .send({ userId: OTHER, freeText: 'help', chargeCredit: false })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(9)
  })
})

describe('PATCH /api/requests/users/:userId/group-tag', () => {
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

  it('404s when the target is an ADMIN', async () => {
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

describe('PATCH /api/requests/users/:userId/credit-adjustment', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/requests/users/user_1/credit-adjustment').send({ delta: 2 })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin user', async () => {
    currentUserId = OTHER
    const res = await request(app).patch('/api/requests/users/user_1/credit-adjustment').send({ delta: 2 })
    expect(res.status).toBe(404)
  })

  it('400s when delta is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/credit-adjustment').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('delta')
  })

  it('400s when delta is zero', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/credit-adjustment').send({ delta: 0 })
    expect(res.status).toBe(400)
  })

  it('400s when delta is not an integer', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/credit-adjustment').send({ delta: 2.5 })
    expect(res.status).toBe(400)
  })

  it('400s when balance would go negative', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER', creditBalance: 2 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/credit-adjustment')
      .send({ delta: -5 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('cannot go below 0')
  })

  it('adds a positive delta to creditBalance and creates a CreditTransaction', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER', creditBalance: 2 })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, creditBalance: 5 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/credit-adjustment')
      .send({ delta: 3 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ clerkId: OTHER, creditBalance: 5 })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { creditBalance: { increment: 3 } },
      select: { clerkId: true, creditBalance: true },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 3, userId: 'user_other' },
    })
  })

  it('subtracts a negative delta from creditBalance and creates a CreditTransaction', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER', creditBalance: 5 })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, creditBalance: 2 })

    const res = await request(app)
      .patch('/api/requests/users/user_other/credit-adjustment')
      .send({ delta: -3 })

    expect(res.status).toBe(200)
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -3, userId: 'user_other' },
    })
  })

  it('404s when the target user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/requests/users/nonexistent/credit-adjustment')
      .send({ delta: 2 })

    expect(res.status).toBe(404)
  })

  it('404s when the target is an ADMIN', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN', creditBalance: 10 })

    const res = await request(app)
      .patch('/api/requests/users/user_1/credit-adjustment')
      .send({ delta: 2 })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
  })
})

describe('PATCH /api/requests/users/:userId/info', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/requests/users/user_1/info').send({ firstName: 'John' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin user', async () => {
    currentUserId = OTHER
    const res = await request(app).patch('/api/requests/users/user_1/info').send({ firstName: 'John' })
    expect(res.status).toBe(404)
  })

  it('400s when no fields are provided', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/info').send({})
    expect(res.status).toBe(400)
  })

  it('400s when phoneNumber is invalid', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/info').send({ phoneNumber: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('phone')
  })

  it('updates firstName only', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, firstName: 'John', lastName: 'Doe', phoneNumber: '1234567890' })

    const res = await request(app)
      .patch('/api/requests/users/user_other/info')
      .send({ firstName: 'John' })

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { firstName: 'John' },
      select: { clerkId: true, firstName: true, lastName: true, phoneNumber: true },
    })
  })

  it('updates phoneNumber and creates a ledger row for phone change', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, firstName: 'Jane', lastName: 'Doe', phoneNumber: '+972501234567' })

    const res = await request(app)
      .patch('/api/requests/users/user_other/info')
      .send({ phoneNumber: '+972501234567' })

    expect(res.status).toBe(200)
    expect(res.body.phoneNumber).toBe('+972501234567')
  })

  it('409s when phoneNumber conflicts with another account (P2002)', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    const err = new Error('Unique constraint failed')
    err.code = 'P2002'
    prismaMock.user.update.mockRejectedValue(err)

    const res = await request(app)
      .patch('/api/requests/users/user_other/info')
      .send({ phoneNumber: '+972501234567' })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('phone number')
  })

  it('404s when the target user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/requests/users/nonexistent/info')
      .send({ firstName: 'John' })

    expect(res.status).toBe(404)
  })

  it('404s when the target is an ADMIN', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const res = await request(app)
      .patch('/api/requests/users/user_1/info')
      .send({ firstName: 'John' })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/requests/users/:userId/block', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/requests/users/user_1/block').send({ blocked: true })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin user', async () => {
    currentUserId = OTHER
    const res = await request(app).patch('/api/requests/users/user_1/block').send({ blocked: true })
    expect(res.status).toBe(404)
  })

  it('400s when blocked is not a boolean', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/requests/users/user_1/block').send({ blocked: 'yes' })
    expect(res.status).toBe(400)
  })

  it('blocks a user', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, isBlocked: true })

    const res = await request(app)
      .patch('/api/requests/users/user_other/block')
      .send({ blocked: true })

    expect(res.status).toBe(200)
    expect(res.body.isBlocked).toBe(true)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: { isBlocked: true },
      select: { clerkId: true, isBlocked: true },
    })
  })

  it('unblocks a user', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    prismaMock.user.update.mockResolvedValue({ clerkId: OTHER, isBlocked: false })

    const res = await request(app)
      .patch('/api/requests/users/user_other/block')
      .send({ blocked: false })

    expect(res.status).toBe(200)
    expect(res.body.isBlocked).toBe(false)
  })

  it('404s when the target user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/requests/users/nonexistent/block')
      .send({ blocked: true })

    expect(res.status).toBe(404)
  })

  it('404s when the target is an ADMIN', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const res = await request(app)
      .patch('/api/requests/users/user_1/block')
      .send({ blocked: true })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/requests/users/:userId', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).delete('/api/requests/users/user_1')
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin user', async () => {
    currentUserId = OTHER
    const res = await request(app).delete('/api/requests/users/user_1')
    expect(res.status).toBe(404)
  })

  it('soft-deletes a user by marking isDeleted, scrubbing PII, and deleting Clerk record', async () => {
    const { notifyAdmins } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' })
    // notifyAdmins looks up all admins to notify via user.findMany
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: ADMIN }])
    prismaMock.user.update.mockResolvedValue({
      clerkId: OTHER,
      firstName: 'Jane',
      lastName: 'Doe',
      isDeleted: true,
      email: null,
      phoneNumber: `deleted-${OTHER}`,
      profilePic: null,
      publicKey: null,
    })

    const res = await request(app).delete('/api/requests/users/user_other')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_other' },
      data: {
        isDeleted: true,
        email: null,
        phoneNumber: `deleted-${OTHER}`,
        profilePic: null,
        publicKey: null,
      },
    })
    expect(notifyAdmins).toHaveBeenCalled()
  })

  it('404s when the target user does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await request(app).delete('/api/requests/users/nonexistent')

    expect(res.status).toBe(404)
  })

  it('404s when the target is an ADMIN', async () => {
    currentUserId = ADMIN
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const res = await request(app).delete('/api/requests/users/user_1')

    expect(res.status).toBe(404)
  })
})

