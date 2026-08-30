// Route tests for invites (G411-41). Same mocking pattern as
// requests.test.js — mocks Prisma and auth, no real DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const USER = 'user_regular'
const ADMIN = 'user_admin'

const usersByClerkId = {
  [USER]: { clerkId: USER, role: 'USER' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN' },
}

let currentUserId = null

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' })
    req.user = usersByClerkId[currentUserId]
    next()
  },
}))

const prismaMock = {
  pendingInvite: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: invitesRouter } = await import('./invites.js')

const app = express()
app.use(express.json())
app.use('/api/invites', invitesRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('POST /api/invites', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/invites').send({})
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin (same convention as requests.js — no 403 leak)', async () => {
    currentUserId = USER
    const res = await request(app).post('/api/invites').send({})
    expect(res.status).toBe(404)
  })

  it('creates an invite with a random token for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.pendingInvite.create.mockImplementation(({ data }) => ({ ...data, createdAt: new Date() }))

    const res = await request(app).post('/api/invites').send({ label: 'Dana' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeTypeOf('string')
    expect(res.body.token.length).toBeGreaterThan(20)
    expect(res.body.label).toBe('Dana')
  })

  it('allows creating an invite with no label', async () => {
    currentUserId = ADMIN
    prismaMock.pendingInvite.create.mockImplementation(({ data }) => ({ ...data, createdAt: new Date() }))

    const res = await request(app).post('/api/invites').send({})

    expect(res.status).toBe(201)
    expect(res.body.label).toBeNull()
  })
})

describe('GET /api/invites', () => {
  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).get('/api/invites')
    expect(res.status).toBe(404)
  })

  it('lists invites for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.pendingInvite.findMany.mockResolvedValue([{ token: 'abc', label: 'Dana', usedAt: null }])

    const res = await request(app).get('/api/invites')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/invites/:token/valid', () => {
  it('no auth required', async () => {
    prismaMock.pendingInvite.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/invites/whatever/valid')
    expect(res.status).toBe(200)
  })

  it('valid for an existing, unused token', async () => {
    prismaMock.pendingInvite.findUnique.mockResolvedValue({ token: 'abc', usedAt: null })
    const res = await request(app).get('/api/invites/abc/valid')
    expect(res.body).toEqual({ valid: true })
  })

  it('invalid for a used token', async () => {
    prismaMock.pendingInvite.findUnique.mockResolvedValue({ token: 'abc', usedAt: new Date() })
    const res = await request(app).get('/api/invites/abc/valid')
    expect(res.body).toEqual({ valid: false })
  })

  it('invalid for a token that does not exist', async () => {
    prismaMock.pendingInvite.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/invites/nonexistent/valid')
    expect(res.body).toEqual({ valid: false })
  })
})
