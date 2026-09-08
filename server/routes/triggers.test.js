// Route tests for triggers (G411-42). Same mocking pattern as
// invites.test.js — mocks Prisma and auth, no real DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Prisma } from '@prisma/client'

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
  trigger: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: triggersRouter } = await import('./triggers.js')

const app = express()
app.use(express.json())
app.use('/api/triggers', triggersRouter)

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

function notFound() {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  })
}

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('GET /api/triggers', () => {
  it('401s when signed out', async () => {
    const res = await request(app).get('/api/triggers')
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).get('/api/triggers')
    expect(res.status).toBe(404)
  })

  it('lists triggers for an admin', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.findMany.mockResolvedValue([{ id: 1, keyword: 'flight', requestType: 'TRAVEL' }])
    const res = await request(app).get('/api/triggers')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /api/triggers', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/triggers').send({ keyword: 'x', requestType: 'TRAVEL' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).post('/api/triggers').send({ keyword: 'x', requestType: 'TRAVEL' })
    expect(res.status).toBe(404)
  })

  it('400s when keyword is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).post('/api/triggers').send({ requestType: 'TRAVEL' })
    expect(res.status).toBe(400)
    expect(prismaMock.trigger.create).not.toHaveBeenCalled()
  })

  it('400s when requestType is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).post('/api/triggers').send({ keyword: 'flight' })
    expect(res.status).toBe(400)
  })

  it('trims the keyword and creates it', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.create.mockImplementation(({ data }) => ({ id: 1, ...data }))
    const res = await request(app).post('/api/triggers').send({ keyword: '  flight  ', requestType: 'TRAVEL' })
    expect(res.status).toBe(201)
    expect(prismaMock.trigger.create).toHaveBeenCalledWith({ data: { keyword: 'flight', requestType: 'TRAVEL' } })
  })

  it('409s on a duplicate keyword/type pair (unique constraint)', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.create.mockRejectedValue(uniqueViolation())
    const res = await request(app).post('/api/triggers').send({ keyword: 'flight', requestType: 'TRAVEL' })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/triggers/:id', () => {
  it('401s when signed out', async () => {
    const res = await request(app).patch('/api/triggers/1').send({ keyword: 'x' })
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).patch('/api/triggers/1').send({ keyword: 'x' })
    expect(res.status).toBe(404)
  })

  it('400s when keyword is missing', async () => {
    currentUserId = ADMIN
    const res = await request(app).patch('/api/triggers/1').send({})
    expect(res.status).toBe(400)
    expect(prismaMock.trigger.update).not.toHaveBeenCalled()
  })

  it('renames the keyword', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.update.mockResolvedValue({ id: 1, keyword: 'flights', requestType: 'TRAVEL' })
    const res = await request(app).patch('/api/triggers/1').send({ keyword: 'flights' })
    expect(res.status).toBe(200)
    expect(prismaMock.trigger.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { keyword: 'flights' } })
  })

  it('409s on renaming into an existing keyword/type pair', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.update.mockRejectedValue(uniqueViolation())
    const res = await request(app).patch('/api/triggers/1').send({ keyword: 'flights' })
    expect(res.status).toBe(409)
  })

  it('404s when the trigger does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.update.mockRejectedValue(notFound())
    const res = await request(app).patch('/api/triggers/999').send({ keyword: 'flights' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/triggers/:id', () => {
  it('401s when signed out', async () => {
    const res = await request(app).delete('/api/triggers/1')
    expect(res.status).toBe(401)
  })

  it('404s for a non-admin', async () => {
    currentUserId = USER
    const res = await request(app).delete('/api/triggers/1')
    expect(res.status).toBe(404)
  })

  it('deletes an existing trigger', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.delete.mockResolvedValue({ id: 1 })
    const res = await request(app).delete('/api/triggers/1')
    expect(res.status).toBe(204)
  })

  it('404s when the trigger does not exist', async () => {
    currentUserId = ADMIN
    prismaMock.trigger.delete.mockRejectedValue(notFound())
    const res = await request(app).delete('/api/triggers/999')
    expect(res.status).toBe(404)
  })
})
