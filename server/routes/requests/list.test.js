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
  // single most recent message — not full message bodies —
  // so the admin list's "time since last activity" column has a real
  // timestamp without paying for every message on every list load.
  // G411-109: now also includes content and userId for both admin and friend
  // callers, for the friend home screen's last-message preview + sender attribution.
  it('includes only the latest message with content and userId by default, not full messages, for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.message).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true, content: true, userId: true },
    })
  })

  it('includes messages for an admin when ?include=messages is given', async () => {
    currentUserId = ADMIN
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests?include=messages')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.message).toEqual({ orderBy: { createdAt: 'asc' } })
  })

  it('ignores ?include=messages for a non-admin, but still includes the last message', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests?include=messages')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    // Non-admin always gets the last message include, just not the full ?include=messages opt-in
    expect(call.include.message).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true, content: true, userId: true },
    })
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

  it('does not include user for a non-admin, but includes the last message', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    // Non-admin gets last message (G411-109) but not user info (still admin-only)
    expect(call.include.message).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true, content: true, userId: true },
    })
    expect(call.include.user).toBeUndefined()
  })

  // G411-109: friends now get the last message include (with content and userId)
  // for the friend home screen's last-message preview + sender attribution.
  it('includes the last message with content and userId for a non-admin', async () => {
    currentUserId = OWNER
    prismaMock.request.findMany.mockResolvedValue([sampleRequest])

    await request(app).get('/api/requests')

    const call = prismaMock.request.findMany.mock.calls[0][0]
    expect(call.include.message).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true, content: true, userId: true },
    })
  })
})

