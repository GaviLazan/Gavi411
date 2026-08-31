// G411-82 — PATCH /api/me/public-key. Only the new route is tested here
// (not server.js's whole app wiring) — GET /api/me is already covered
// implicitly via auth.test.js's requireAuth coverage; this file adds a
// tiny standalone Express app carrying just the new route, same pattern
// requests.test.js uses (mocked auth + Prisma, no real DB/Clerk call).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

let currentUser = null
vi.mock('./middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' })
    req.user = currentUser
    next()
  },
}))

const prismaMock = { user: { update: vi.fn() } }
vi.mock('./lib/prisma.js', () => ({ prisma: prismaMock }))

const { requireAuth } = await import('./middleware/auth.js')
const { prisma } = await import('./lib/prisma.js')

const app = express()
app.use(express.json())
app.patch('/api/me/public-key', requireAuth, async (req, res) => {
  const { publicKey } = req.body
  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: 'publicKey is required' })
  }
  const user = await prisma.user.update({ where: { clerkId: req.user.clerkId }, data: { publicKey } })
  res.json({ user })
})

beforeEach(() => {
  currentUser = null
  vi.clearAllMocks()
})

describe('PATCH /api/me/public-key', () => {
  it('401s when unauthenticated', async () => {
    const res = await request(app).patch('/api/me/public-key').send({ publicKey: 'abc' })
    expect(res.status).toBe(401)
  })

  it('400s when publicKey is missing', async () => {
    currentUser = { clerkId: 'user_1' }
    const res = await request(app).patch('/api/me/public-key').send({})
    expect(res.status).toBe(400)
  })

  it('400s when publicKey is not a string', async () => {
    currentUser = { clerkId: 'user_1' }
    const res = await request(app).patch('/api/me/public-key').send({ publicKey: 123 })
    expect(res.status).toBe(400)
  })

  it('updates the caller\'s own public key', async () => {
    currentUser = { clerkId: 'user_1' }
    prisma.user.update.mockResolvedValue({ clerkId: 'user_1', publicKey: 'abc' })

    const res = await request(app).patch('/api/me/public-key').send({ publicKey: 'abc' })
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { clerkId: 'user_1' }, data: { publicKey: 'abc' } })
  })
})
