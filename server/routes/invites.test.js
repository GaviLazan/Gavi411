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
    updateMany: vi.fn(),
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

  it('returns a random escrow passphrase, distinct from the token', async () => {
    currentUserId = ADMIN
    prismaMock.pendingInvite.create.mockImplementation(({ data }) => ({ ...data, createdAt: new Date() }))

    const res = await request(app).post('/api/invites').send({})

    expect(res.body.passphrase).toBeTypeOf('string')
    expect(res.body.passphrase.length).toBeGreaterThan(10)
    expect(res.body.passphrase).not.toBe(res.body.token)
  })

  it('does not persist the passphrase (create() call has no passphrase field)', async () => {
    currentUserId = ADMIN
    prismaMock.pendingInvite.create.mockImplementation(({ data }) => ({ ...data, createdAt: new Date() }))

    await request(app).post('/api/invites').send({})

    const createArgs = prismaMock.pendingInvite.create.mock.calls[0][0]
    expect(createArgs.data).not.toHaveProperty('passphrase')
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

describe('PATCH /api/invites/:token/backup', () => {
  const validBody = { salt: 'c2FsdA==', iv: 'aXY=', ciphertext: 'Y2lwaGVy' }

  it('401s when signed out', async () => {
    const res = await request(app).patch('/api/invites/tok/backup').send(validBody)
    expect(res.status).toBe(401)
    expect(prismaMock.pendingInvite.updateMany).not.toHaveBeenCalled()
  })

  it('400s if salt, iv, or ciphertext is missing', async () => {
    currentUserId = USER
    const res = await request(app).patch('/api/invites/tok/backup').send({ salt: 'x' })
    expect(res.status).toBe(400)
    expect(prismaMock.pendingInvite.updateMany).not.toHaveBeenCalled()
  })

  it('only claims a token this signed-in user actually owns, with no existing backup', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.updateMany.mockResolvedValue({ count: 1 })
    await request(app).patch('/api/invites/tok/backup').send(validBody)

    const call = prismaMock.pendingInvite.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ token: 'tok', usedByUserId: USER, backupCiphertext: null })
    expect(call.data).toEqual({ backupSalt: 'c2FsdA==', backupIv: 'aXY=', backupCiphertext: 'Y2lwaGVy' })
  })

  it('404s when the token does not exist, is not owned by this user, or already has a backup', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).patch('/api/invites/tok/backup').send(validBody)
    expect(res.status).toBe(404)
  })

  it('a token-squatter signed in as a different user cannot claim someone else\'s backup slot', async () => {
    // Same scenario as the ownership-scoped WHERE test above, from the
    // attacker's side: updateMany's WHERE (token + usedByUserId: ATTACKER)
    // matches zero rows for a token actually claimed by someone else, so
    // this always resolves the same way real Prisma would for a mismatch.
    currentUserId = USER
    prismaMock.pendingInvite.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).patch('/api/invites/someone-elses-token/backup').send(validBody)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/invites/:token/backup', () => {
  it('401s when signed out', async () => {
    const res = await request(app).get('/api/invites/tok/backup')
    expect(res.status).toBe(401)
  })

  it('returns the backup when the signed-in user owns this invite', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.findUnique.mockResolvedValue({
      usedByUserId: USER, backupSalt: 's', backupIv: 'i', backupCiphertext: 'c',
    })
    const res = await request(app).get('/api/invites/tok/backup')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ salt: 's', iv: 'i', ciphertext: 'c' })
  })

  it('404s when the token does not exist', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/invites/nonexistent/backup')
    expect(res.status).toBe(404)
  })

  it('404s when the token exists but has no backup uploaded yet', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.findUnique.mockResolvedValue({
      usedByUserId: USER, backupSalt: null, backupIv: null, backupCiphertext: null,
    })
    const res = await request(app).get('/api/invites/tok/backup')
    expect(res.status).toBe(404)
  })

  it('404s when the token belongs to a different user (no cross-account backup fetch)', async () => {
    currentUserId = USER
    prismaMock.pendingInvite.findUnique.mockResolvedValue({
      usedByUserId: 'someone_else', backupSalt: 's', backupIv: 'i', backupCiphertext: 'c',
    })
    const res = await request(app).get('/api/invites/tok/backup')
    expect(res.status).toBe(404)
  })
})
