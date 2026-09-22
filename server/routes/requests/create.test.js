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

describe('POST /api/requests/overdraft-request (G411-47)', () => {
  beforeEach(() => {
    currentUserId = OWNER
  })

  it('401s when unauthenticated', async () => {
    currentUserId = null
    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })
    expect(res.status).toBe(401)
  })

  it('400s when freeText is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: null })
    const res = await request(app).post('/api/requests/overdraft-request').send({})
    expect(res.status).toBe(400)
  })

  it('creates an OVERDRAFT_PENDING request with isOverdraft: true and deducts NOTHING', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: null })
    prismaMock.request.create.mockResolvedValue({
      id: 1, freeText: 'help', userId: OWNER, status: 'OVERDRAFT_PENDING', isOverdraft: true, publicId: 'abc123',
    })
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: ADMIN }])

    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('OVERDRAFT_PENDING')
    expect(prismaMock.request.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'OVERDRAFT_PENDING', isOverdraft: true, userId: OWNER }),
    })
    // The critical property: no deduction, no ledger row, ever, for this route.
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creditBalance: expect.anything() }) }),
    )
  })

  it('notifies admins via Telegram with a permalink (G411-50 Sibling review finding)', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://example.com')
    const { notifyAdmins } = await import('../../lib/notify.js')
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: null })
    prismaMock.request.create.mockResolvedValue({
      id: 1, freeText: 'help', userId: OWNER, status: 'OVERDRAFT_PENDING', isOverdraft: true, publicId: 'abc123',
    })
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: ADMIN }])

    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(res.status).toBe(201)
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Overdraft ask'),
        body: 'help',
        link: expect.stringContaining('/r/abc123'),
      }),
      expect.objectContaining({ telegram: true }),
    )
    vi.unstubAllEnvs()
  })

  it('stamps overdraftUsedAt on the user when a request is created', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: null })
    prismaMock.request.create.mockResolvedValue({
      id: 1,
      status: 'OVERDRAFT_PENDING',
      isOverdraft: true,
      freeText: 'help',
      publicId: 'abc123',
    })
    prismaMock.user.findMany.mockResolvedValue([])

    await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: OWNER },
      data: { overdraftUsedAt: expect.any(Date) },
    })
  })

  it('400s when the friend still has a real balance (>= 1)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 1, overdraftUsedAt: null })

    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/still have credits/)
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('400s when overdraftUsedAt is already set this calendar month', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: new Date() })

    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already used your one-time overdraft/)
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('allows a new overdraft request when the prior one was used in an earlier calendar month', async () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0, overdraftUsedAt: lastMonth })
    prismaMock.request.create.mockResolvedValue({
      id: 1,
      status: 'OVERDRAFT_PENDING',
      isOverdraft: true,
      freeText: 'help',
      publicId: 'abc123',
    })
    prismaMock.user.findMany.mockResolvedValue([])

    const res = await request(app).post('/api/requests/overdraft-request').send({ freeText: 'help' })

    expect(res.status).toBe(201)
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
    const { matchKeywords } = await import('../../lib/matchKeywords.js')
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
    const { matchKeywords } = await import('../../lib/matchKeywords.js')
    matchKeywords.mockRejectedValue(new Error('connection lost'))

    const res = await request(app).post('/api/requests/match').send({ freeText: 'need a flight' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to match request type' })
  })
})

describe('GET /api/requests/by-public-id/:publicId', () => {
  const publicId = 'abc-123_DEF'
  // Route now selects only { id, userId } (Sibling review finding: the
  // full MESSAGE_INCLUDE payload was fetched here and immediately
  // discarded, since RequestDetail.jsx re-fetches the real detail via
  // GET /:id right after) — mock the same minimal shape Prisma actually
  // returns for this query.
  const minimalRequestWithPublicId = { id: sampleRequest.id, userId: sampleRequest.userId }

  it('401s when unauthenticated', async () => {
    const res = await request(app).get(`/api/requests/by-public-id/${publicId}`)
    expect(res.status).toBe(401)
  })

  it('returns 404 when request not found', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(null)

    const res = await request(app).get(`/api/requests/by-public-id/${publicId}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Request not found' })
    expect(prismaMock.request.findUnique).toHaveBeenCalledWith({
      where: { publicId },
      select: { id: true, userId: true },
    })
  })

  it('returns the request id when owner requests their own', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(minimalRequestWithPublicId)

    const res = await request(app).get(`/api/requests/by-public-id/${publicId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(minimalRequestWithPublicId.id)
  })

  it('returns 404 when non-owner requests (never leaks existence)', async () => {
    currentUserId = OTHER
    prismaMock.request.findUnique.mockResolvedValue(minimalRequestWithPublicId)

    const res = await request(app).get(`/api/requests/by-public-id/${publicId}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Request not found' })
  })

  it('allows admin to view any request', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(minimalRequestWithPublicId)

    const res = await request(app).get(`/api/requests/by-public-id/${publicId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(minimalRequestWithPublicId.id)
  })

  it('does not collide with the numeric :id route', async () => {
    currentUserId = OWNER
    // GET /:id only ever matches a single path segment, so a two-segment
    // path like /by-public-id/<publicId> can never reach it regardless of
    // declaration order. This confirms /by-public-id/<publicId> reaches
    // the publicId handler correctly.
    const stringPublicId = 'abcd-EFGH_ijkl'
    prismaMock.request.findUnique.mockResolvedValue(minimalRequestWithPublicId)

    const res = await request(app).get(`/api/requests/by-public-id/${stringPublicId}`)

    expect(res.status).toBe(200)
    expect(prismaMock.request.findUnique).toHaveBeenCalledWith({
      where: { publicId: stringPublicId },
      select: { id: true, userId: true },
    })
  })
})
