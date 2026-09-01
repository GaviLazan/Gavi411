// Route tests for device-linking (G411-28, 2026-09-01). Same mocking
// pattern as invites.test.js/requests.test.js — mocks Prisma and auth, no
// real DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const USER = 'user_regular'
const ADMIN = 'user_admin'

const usersByClerkId = {
  [USER]: { clerkId: USER, role: 'USER', firstName: 'Regular', lastName: 'Friend' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN', firstName: 'Gavi', lastName: 'Lazan' },
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
  device: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  conversationDeviceKey: {
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  request: {
    count: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((ops) => Promise.all(ops)),
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: devicesRouter } = await import('./devices.js')

const app = express()
app.use(express.json())
app.use('/api/devices', devicesRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('POST /api/devices', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/devices').send({ publicKey: 'abc' })
    expect(res.status).toBe(401)
  })

  it('400s with no publicKey', async () => {
    currentUserId = USER
    const res = await request(app).post('/api/devices').send({})
    expect(res.status).toBe(400)
  })

  it('creates a PENDING device row for the signed-in user', async () => {
    currentUserId = USER
    prismaMock.device.create.mockImplementation(({ data }) => ({
      id: 1,
      status: 'PENDING',
      createdAt: new Date(),
      ...data,
    }))

    const res = await request(app).post('/api/devices').send({ publicKey: 'device-pub-key' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('PENDING')
    expect(prismaMock.device.create).toHaveBeenCalledWith({
      data: { userId: USER, publicKey: 'device-pub-key' },
    })
  })
})

describe('GET /api/devices/pending', () => {
  it('404s for a non-admin (same convention as invites.js — no 403 leak)', async () => {
    currentUserId = USER
    const res = await request(app).get('/api/devices/pending')
    expect(res.status).toBe(404)
  })

  it('lists pending devices with the requesting user attached, for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.device.findMany.mockResolvedValue([
      { id: 1, status: 'PENDING', user: { firstName: 'Allysa', lastName: 'Jeret', email: 'ajeret@gmail.com' } },
    ])

    const res = await request(app).get('/api/devices/pending')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].user.firstName).toBe('Allysa')
  })
})

describe('POST /api/devices/:id/approve', () => {
  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).post('/api/devices/1/approve').send({ wrappedKeys: [] })
    expect(res.status).toBe(404)
  })

  it('400s with no wrappedKeys array', async () => {
    currentUserId = ADMIN
    const res = await request(app).post('/api/devices/1/approve').send({})
    expect(res.status).toBe(400)
  })

  it('404s for a device that is not PENDING', async () => {
    currentUserId = ADMIN
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, status: 'APPROVED' })
    const res = await request(app).post('/api/devices/1/approve').send({ wrappedKeys: [] })
    expect(res.status).toBe(404)
  })

  it('400s when a wrappedKeys requestId does not belong to the device owner (Sibling review finding)', async () => {
    currentUserId = ADMIN
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, status: 'PENDING', userId: USER })
    prismaMock.request.count.mockResolvedValue(0) // the requestId belongs to someone else

    const res = await request(app)
      .post('/api/devices/1/approve')
      .send({ wrappedKeys: [{ requestId: 999, wrappedKey: 'wk', iv: 'iv' }] })

    expect(res.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('marks the device APPROVED and persists the wrapped keys in one transaction', async () => {
    currentUserId = ADMIN
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, status: 'PENDING', userId: USER })
    prismaMock.request.count.mockResolvedValue(1) // the one requestId genuinely belongs to USER

    const res = await request(app)
      .post('/api/devices/1/approve')
      .send({ wrappedKeys: [{ requestId: 5, wrappedKey: 'wk', iv: 'iv' }] })

    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    expect(prismaMock.conversationDeviceKey.createMany).toHaveBeenCalledWith({
      data: [{ requestId: 5, deviceId: 1, wrappedKey: 'wk', iv: 'iv' }],
      skipDuplicates: true,
    })
  })
})

describe('POST /api/devices/:id/reject', () => {
  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).post('/api/devices/1/reject')
    expect(res.status).toBe(404)
  })

  it('404s if no PENDING device matches', async () => {
    currentUserId = ADMIN
    prismaMock.device.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).post('/api/devices/1/reject')
    expect(res.status).toBe(404)
  })

  it('rejects a pending device', async () => {
    currentUserId = ADMIN
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 })
    const res = await request(app).post('/api/devices/1/reject')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/devices/my-keys', () => {
  it('404s when the device does not belong to the caller', async () => {
    currentUserId = USER
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, userId: ADMIN, status: 'APPROVED' })
    const res = await request(app).get('/api/devices/my-keys?deviceId=1')
    expect(res.status).toBe(404)
  })

  it('404s when the device is not APPROVED yet', async () => {
    currentUserId = USER
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, userId: USER, status: 'PENDING' })
    const res = await request(app).get('/api/devices/my-keys?deviceId=1')
    expect(res.status).toBe(404)
  })

  it('returns admin public key + wrapped keys for an approved own device', async () => {
    currentUserId = USER
    prismaMock.device.findUnique.mockResolvedValue({ id: 1, userId: USER, status: 'APPROVED' })
    prismaMock.user.findFirst.mockResolvedValue({ publicKey: 'admin-pub-key' })
    prismaMock.conversationDeviceKey.findMany.mockResolvedValue([
      { requestId: 5, wrappedKey: 'wk', iv: 'iv' },
    ])

    const res = await request(app).get('/api/devices/my-keys?deviceId=1')

    expect(res.status).toBe(200)
    expect(res.body.adminPublicKey).toBe('admin-pub-key')
    expect(res.body.keys).toEqual([{ requestId: 5, wrappedKey: 'wk', iv: 'iv' }])
  })
})
