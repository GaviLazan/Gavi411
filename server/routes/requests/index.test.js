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
describe('stripEmpty (G411-74 Sibling review finding)', () => {
  it('drops a nested object whose fields are all empty, not just top-level empties', async () => {
    // TravelFields' new hotel/car objects (G411-74) — an all-blank toggled-on
    // panel used to survive as junk since stripEmpty only recursed into arrays.
    const { stripEmpty } = await import('./index.js')
    expect(stripEmpty({ hotel: { date: '', location: '', company: '', ref: '' }, car: null, destination: 'Paris' }))
      .toEqual({ destination: 'Paris' })
  })

  it('keeps a nested object but strips only its empty fields', async () => {
    const { stripEmpty } = await import('./index.js')
    expect(stripEmpty({ hotel: { date: 'Sep 1', location: '', company: '', ref: '' } }))
      .toEqual({ hotel: { date: 'Sep 1' } })
  })
})

describe('buildPermalink (G411-50 Sibling review finding)', () => {
  it('builds a /r/<publicId> URL from FRONTEND_URL', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://example.com')
    const { buildPermalink } = await import('./index.js')
    expect(buildPermalink('abc123')).toBe('https://example.com/r/abc123')
    vi.unstubAllEnvs()
  })

  it('returns undefined (omits the link) when FRONTEND_URL is unset', async () => {
    vi.stubEnv('FRONTEND_URL', '')
    const { buildPermalink } = await import('./index.js')
    expect(buildPermalink('abc123')).toBeUndefined()
    vi.unstubAllEnvs()
  })
})

describe('POST / request creation notification (G411-51)', () => {
  it('calls notifyAdmins with telegram flag when request is successfully created', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://example.com')
    const { notifyAdmins } = await import('../../lib/notify.js')
    currentUserId = OWNER

    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: OWNER, role: 'USER', balance: 10 }])
    prismaMock.request.create.mockResolvedValue({ id: 1, userId: OWNER, freeText: 'help me', publicId: 'abc123' })
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))

    const res = await request(app).post('/api/requests').send({
      freeText: 'help me',
      urgency: 'NORMAL',
    })

    expect(res.status).toBe(201)
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('New ask'),
        body: 'help me',
        link: expect.stringContaining('/r/abc123')
      }),
      expect.objectContaining({ telegram: true }),
    )
    vi.unstubAllEnvs()
  })

  it('prefixes body with "Urgent" when urgency is HIGH', async () => {
    const { notifyAdmins } = await import('../../lib/notify.js')
    currentUserId = OWNER

    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: OWNER, role: 'USER', balance: 10 }])
    prismaMock.request.create.mockResolvedValue({
      id: 1,
      userId: OWNER,
      freeText: 'help me',
      publicId: 'abc123',
      urgency: 'HIGH',
    })
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))

    const res = await request(app).post('/api/requests').send({
      freeText: 'help me',
      urgency: 'HIGH',
    })

    expect(res.status).toBe(201)
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'help me\nUrgent' }),
      expect.objectContaining({ telegram: true }),
    )
  })

  it('omits the link instead of sending a broken URL when FRONTEND_URL is unset', async () => {
    vi.stubEnv('FRONTEND_URL', '')
    const { notifyAdmins } = await import('../../lib/notify.js')
    currentUserId = OWNER

    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })
    prismaMock.user.findMany.mockResolvedValue([{ clerkId: OWNER, role: 'USER', balance: 10 }])
    prismaMock.request.create.mockResolvedValue({ id: 1, userId: OWNER, freeText: 'help me', publicId: 'abc123' })
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))

    const res = await request(app).post('/api/requests').send({
      freeText: 'help me',
      urgency: 'NORMAL',
    })

    expect(res.status).toBe(201)
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ link: undefined }),
      expect.objectContaining({ telegram: true }),
    )
    vi.unstubAllEnvs()
  })
})

describe('POST /:id/messages notification (G411-51)', () => {
  it('calls notifyAdmins when friend sends a message', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://example.com')
    const { notifyAdmins } = await import('../../lib/notify.js')
    currentUserId = OWNER

    const request1 = { id: 1, userId: OWNER, status: 'IN_QUEUE', freeText: 'original request', publicId: 'req123' }
    prismaMock.request.findUnique.mockResolvedValue(request1)
    prismaMock.message.create.mockResolvedValue({
      id: 1,
      requestId: 1,
      userId: OWNER,
      content: 'help',
    })

    const res = await request(app).post('/api/requests/1/messages').send({
      content: 'help',
    })

    expect(res.status).toBe(201)
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('New message'),
        body: 'in original request',
        link: expect.stringContaining('/r/req123')
      }),
      expect.objectContaining({ telegram: true }),
    )
    vi.unstubAllEnvs()
  })

  it('calls notifyUser when admin sends a message to friend', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN

    const request1 = { id: 1, userId: OWNER, status: 'IN_QUEUE' }
    prismaMock.request.findUnique.mockResolvedValue(request1)
    prismaMock.message.create.mockResolvedValue({
      id: 1,
      requestId: 1,
      userId: ADMIN,
      content: 'response',
    })

    const res = await request(app).post('/api/requests/1/messages').send({
      content: 'response',
    })

    expect(res.status).toBe(201)
    expect(notifyUser).toHaveBeenCalledWith(
      OWNER,
      expect.objectContaining({ title: 'New message' }),
      expect.anything(),
    )
  })
})

describe('PATCH /:id status change notification (G411-51)', () => {
  beforeEach(() => {
    prismaMock.message.findFirst.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))
  })

  it('notifies user on status change to WAITING_ON_USER', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'WORKING_ON_IT',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: false,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'WAITING_ON_USER',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'WAITING_ON_USER',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).toHaveBeenCalledWith(
      OWNER,
      expect.objectContaining({ title: 'Gavi needs more info from you' }),
      expect.objectContaining({ excludeClerkId: ADMIN }),
    )
  })

  it('notifies user on status change to RESOLVED_PENDING_CONFIRMATION', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'WORKING_ON_IT',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: false,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'RESOLVED_PENDING_CONFIRMATION',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'RESOLVED_PENDING_CONFIRMATION',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).toHaveBeenCalled()
  })

  it('notifies user on status change to OVERDRAFT_DENIED', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'OVERDRAFT_PENDING',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: true,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'OVERDRAFT_DENIED',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'OVERDRAFT_DENIED',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).toHaveBeenCalled()
  })

  it('does not notify user on status change to RECEIVED', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'IN_QUEUE',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: false,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'RECEIVED',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'RECEIVED',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('notifies user on OVERDRAFT_PENDING → IN_QUEUE approval', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'OVERDRAFT_PENDING',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: true,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'IN_QUEUE',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'IN_QUEUE',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).toHaveBeenCalled()
  })

  it('suppresses self-notification by passing excludeClerkId', async () => {
    const { notifyUser } = await import('../../lib/notify.js')
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({
      id: 1,
      status: 'WORKING_ON_IT',
      urgency: 'NORMAL',
      userId: OWNER,
      isOverdraft: false,
      message: [],
    })
    prismaMock.request.update.mockResolvedValue({
      id: 1,
      status: 'WAITING_ON_USER',
      userId: OWNER,
      message: [],
    })

    const res = await request(app).patch('/api/requests/1').send({
      status: 'WAITING_ON_USER',
    })

    expect(res.status).toBe(200)
    expect(notifyUser).toHaveBeenCalledWith(
      OWNER,
      expect.anything(),
      expect.objectContaining({ excludeClerkId: OWNER }),
    )
  })
})

