// Route tests for presence (G411-43). Same mocking pattern as
// triggers.test.js — mocks Prisma and auth, no real DB touched.

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
  requireAdmin: (req, res, next) => {
    if (req.user.role !== 'ADMIN') return res.status(404).json({ error: 'Not found' })
    next()
  },
}))

const prismaMock = {
  presence: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: presenceRouter } = await import('./presence.js')

const app = express()
app.use(express.json())
app.use('/api/presence', presenceRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('GET /api/presence', () => {
  it('succeeds with no auth at all', async () => {
    prismaMock.presence.findUnique.mockResolvedValue({ id: 'singleton', isOnline: true })
    const res = await request(app).get('/api/presence')
    expect(res.status).toBe(200)
  })

  it('returns the isOnline value from the DB when the row exists', async () => {
    prismaMock.presence.findUnique.mockResolvedValue({ id: 'singleton', isOnline: false })
    const res = await request(app).get('/api/presence')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'singleton', isOnline: false })
  })

  it('defaults to { isOnline: true } when the row does not exist', async () => {
    prismaMock.presence.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/presence')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isOnline: true })
  })
})

describe('PATCH /api/presence', () => {
  it('401s when signed out', async () => {
    const res = await request(app).patch('/api/presence').send({ isOnline: true })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).patch('/api/presence').send({ isOnline: true })
    expect(res.status).toBe(404)
  })

  it('400s when isOnline is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/presence').send({})
    expect(res.status).toBe(400)
    expect(prismaMock.presence.upsert).not.toHaveBeenCalled()
  })

  it('400s when isOnline is a string', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/presence').send({ isOnline: 'true' })
    expect(res.status).toBe(400)
    expect(prismaMock.presence.upsert).not.toHaveBeenCalled()
  })

  it('400s when isOnline is a number', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/presence').send({ isOnline: 1 })
    expect(res.status).toBe(400)
    expect(prismaMock.presence.upsert).not.toHaveBeenCalled()
  })

  it('upserts and returns the new state for an admin with isOnline: true', async () => {
    currentUserId = ADMIN
    prismaMock.presence.upsert.mockResolvedValue({ id: 'singleton', isOnline: true })
    const res = await request(app).patch('/api/presence').send({ isOnline: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'singleton', isOnline: true })
    expect(prismaMock.presence.upsert).toHaveBeenCalledWith({
      where: { id: 'singleton' },
      create: { id: 'singleton', isOnline: true },
      update: { isOnline: true },
    })
  })

  it('upserts and returns the new state for an admin with isOnline: false', async () => {
    currentUserId = ADMIN
    prismaMock.presence.upsert.mockResolvedValue({ id: 'singleton', isOnline: false })
    const res = await request(app).patch('/api/presence').send({ isOnline: false })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'singleton', isOnline: false })
    expect(prismaMock.presence.upsert).toHaveBeenCalledWith({
      where: { id: 'singleton' },
      create: { id: 'singleton', isOnline: false },
      update: { isOnline: false },
    })
  })
})
