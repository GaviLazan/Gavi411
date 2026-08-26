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

const usersByClerkId = {
  [OWNER]: { clerkId: OWNER, role: 'USER' },
  [OTHER]: { clerkId: OTHER, role: 'USER' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN' },
}

// Swapped per-test via currentUserId to simulate different signed-in users.
let currentUserId = null

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' })
    req.user = usersByClerkId[currentUserId]
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
  },
  message: {
    create: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../lib/matchKeywords.js', () => ({ matchKeywords: vi.fn() }))

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

  it('updates status for the owner on a legal enum value', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, status: 'CLOSED' })

    const res = await request(app).patch('/api/requests/1').send({ status: 'CLOSED' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CLOSED')
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CLOSED' },
    })
  })

  it('allows an admin to update someone else\'s request', async () => {
    currentUserId = ADMIN
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.request.update.mockResolvedValue({ ...sampleRequest, urgency: 'HIGH' })

    const res = await request(app).patch('/api/requests/1').send({ urgency: 'HIGH' })
    expect(res.status).toBe(200)
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
      data: { content: 'hi', imageUrl: null, requestId: 1, userId: OWNER },
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
