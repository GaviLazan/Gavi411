// Route tests for push subscribe/unsubscribe (G411-29). Same mocking
// pattern as devices.test.js — mocks Prisma and auth, no real DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const USER = 'user_regular'

let currentUserId = null

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' })
    req.user = { clerkId: currentUserId }
    next()
  },
}))

const prismaMock = {
  pushSubscription: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: router } = await import('./pushSubscriptions.js')

const app = express()
app.use(express.json())
app.use('/api/push', router)

beforeEach(() => {
  vi.clearAllMocks()
  currentUserId = USER
})

describe('POST /api/push', () => {
  it('rejects a request missing endpoint or keys', async () => {
    const res = await request(app).post('/api/push').send({ endpoint: 'https://push.example/a' })
    expect(res.status).toBe(400)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('rejects a request where endpoint/keys are the wrong type (Sibling review finding)', async () => {
    const res = await request(app)
      .post('/api/push')
      .send({ endpoint: 12345, keys: { p256dh: {}, auth: 'a' } })
    expect(res.status).toBe(400)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('upserts a subscription keyed by endpoint, scoped to the signed-in user', async () => {
    prismaMock.pushSubscription.upsert.mockResolvedValue({ id: 1 })

    const res = await request(app)
      .post('/api/push')
      .send({ endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } })

    expect(res.status).toBe(201)
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/a' },
      update: { userId: USER, p256dh: 'p', auth: 'a' },
      create: { userId: USER, endpoint: 'https://push.example/a', p256dh: 'p', auth: 'a' },
    })
  })
})

describe('DELETE /api/push', () => {
  it('only deletes subscriptions matching both endpoint and the signed-in user', async () => {
    const res = await request(app).delete('/api/push').send({ endpoint: 'https://push.example/a' })

    expect(res.status).toBe(204)
    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/a', userId: USER },
    })
  })
})
