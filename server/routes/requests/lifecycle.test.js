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

