// Route tests for complete-profile (G411-69). Same mocking pattern as
// presence.test.js — mocks Prisma and auth, no real DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Prisma } from '@prisma/client'

const USER = 'user_regular'
const ADMIN = 'user_admin'

const usersByClerkId = {
  [USER]: { clerkId: USER, role: 'USER', username: null, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN', username: null, firstName: 'Admin', lastName: 'User', email: 'admin@example.com' },
}

let currentUserId = null

const clerkClientMock = {
  users: {
    getUser: vi.fn(),
  },
}

vi.mock('@clerk/express', () => ({
  clerkClient: clerkClientMock,
}))

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
  user: {
    update: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: completeProfileRouter } = await import('./completeProfile.js')

const app = express()
app.use(express.json())
app.use('/api/me', completeProfileRouter)

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

function recordNotFound() {
  return new Prisma.PrismaClientKnownRequestError('Record to update not found', {
    code: 'P2025',
    clientVersion: 'test',
  })
}

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('PATCH /api/me/complete-profile', () => {
  it('401s when signed out', async () => {
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(401)
  })

  it('400s when phoneNumber is missing', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid phone number')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('400s when phoneNumber is too short (e.g. "123")', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid phone number')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('400s when phoneNumber has no digits at all (e.g. "abc")', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid phone number')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('400s a 7-digit number the client would never send (Sibling review finding — server floor was lower than the client\'s)', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '1234567' })
    expect(res.status).toBe(400)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('accepts a valid Israeli local-format number like "050-1234567"', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      phoneNumber: '050-1234567',
      profilePic: null,
    })
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: USER },
      data: { phoneNumber: '050-1234567' },
    })
  })

  it('accepts a valid number with explicit country code like "+972501234567"', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      phoneNumber: '+972501234567',
      profilePic: null,
    })
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '+972501234567' })
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: USER },
      data: { phoneNumber: '+972501234567' },
    })
  })

  it('updates profilePic when provided', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      phoneNumber: '050-1234567',
      profilePic: 'https://example.com/photo.jpg',
    })
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567', profilePic: 'https://example.com/photo.jpg' })
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: USER },
      data: {
        phoneNumber: '050-1234567',
        profilePic: 'https://example.com/photo.jpg',
      },
    })
  })

  it('does NOT touch profilePic when omitted from the body', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      phoneNumber: '050-1234567',
      profilePic: null,
    })
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(200)
    // Verify profilePic is not in the data object
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).not.toHaveProperty('profilePic')
  })

  it('409s when the phone number is already taken', async () => {
    currentUserId = USER
    prismaMock.user.update.mockRejectedValue(uniqueViolation())
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('That phone number is already registered to another account')
  })

  it('404s cleanly (not an unhandled 500) if the user row is gone (Sibling review finding)', async () => {
    currentUserId = USER
    prismaMock.user.update.mockRejectedValue(recordNotFound())
    const res = await request(app)
      .patch('/api/me/complete-profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(404)
  })
})

// G411-80: /api/me/profile updates ONLY phoneNumber — name/username/email/
// photo are handled by Clerk's own account modal client-side (Gavi's call:
// no need to duplicate a UI Clerk already does well), so this route stays
// as narrow as /complete-profile's own phone-only validation/error shape.
describe('PATCH /api/me/profile', () => {
  it('401s when signed out', async () => {
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(401)
  })

  it('updates the phone number', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      phoneNumber: '+972501234567',
    })
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ phoneNumber: '+972501234567' })
    expect(res.status).toBe(200)
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({ phoneNumber: '+972501234567' })
  })

  it('400s when phoneNumber is missing', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/profile')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid phone number')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('400s when phoneNumber format is invalid', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ phoneNumber: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid phone number')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('409s when the phone number is already taken', async () => {
    currentUserId = USER
    prismaMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`phoneNumber`)', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['phoneNumber'] },
      })
    )
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('That phone number is already registered to another account')
  })

  it('404s when the user row is gone', async () => {
    currentUserId = USER
    prismaMock.user.update.mockRejectedValue(recordNotFound())
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ phoneNumber: '050-1234567' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Account not found')
  })
})

describe('POST /api/me/sync-from-clerk', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/me/sync-from-clerk')
    expect(res.status).toBe(401)
  })

  it('writes only the fields that changed (username backfill, name/email untouched)', async () => {
    currentUserId = USER
    clerkClientMock.users.getUser.mockResolvedValue({
      username: 'johnny',
      firstName: 'John',
      lastName: 'Doe',
      emailAddresses: [{ id: 'em_1', emailAddress: 'john@example.com' }],
      primaryEmailAddressId: 'em_1',
    })
    prismaMock.user.update.mockResolvedValue({ ...usersByClerkId[USER], username: 'johnny' })
    const res = await request(app).post('/api/me/sync-from-clerk')
    expect(res.status).toBe(200)
    expect(res.body.changed).toBe(true)
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({ username: 'johnny' })
  })

  it('reports changed: false and skips the write when nothing drifted', async () => {
    currentUserId = USER
    clerkClientMock.users.getUser.mockResolvedValue({
      username: null,
      firstName: 'John',
      lastName: 'Doe',
      emailAddresses: [{ id: 'em_1', emailAddress: 'john@example.com' }],
      primaryEmailAddressId: 'em_1',
    })
    const res = await request(app).post('/api/me/sync-from-clerk')
    expect(res.status).toBe(200)
    expect(res.body.changed).toBe(false)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('502s if the Clerk fetch fails', async () => {
    currentUserId = USER
    clerkClientMock.users.getUser.mockRejectedValue(new Error('Clerk API error'))
    const res = await request(app).post('/api/me/sync-from-clerk')
    expect(res.status).toBe(502)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('409s if the synced value now conflicts with another account', async () => {
    currentUserId = USER
    clerkClientMock.users.getUser.mockResolvedValue({
      username: 'taken',
      firstName: 'John',
      lastName: 'Doe',
      emailAddresses: [{ id: 'em_1', emailAddress: 'john@example.com' }],
      primaryEmailAddressId: 'em_1',
    })
    prismaMock.user.update.mockRejectedValue(uniqueViolation())
    const res = await request(app).post('/api/me/sync-from-clerk')
    expect(res.status).toBe(409)
  })
})
