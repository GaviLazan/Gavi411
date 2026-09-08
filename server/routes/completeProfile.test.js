// Route tests for complete-profile (G411-69). Same mocking pattern as
// presence.test.js — mocks Prisma and auth, no real DB touched.

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

// Mock clerkClient — define the mock object before vi.mock() to avoid
// hoisting reference errors in the factory function.
const clerkClientMock = {
  users: {
    updateUser: vi.fn(),
    replaceUserEmailAddress: vi.fn(),
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

describe('PATCH /api/me/profile', () => {
  it('401s when signed out', async () => {
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ firstName: 'John' })
    expect(res.status).toBe(401)
  })

  it('updates only provided fields (partial update — name only)', async () => {
    currentUserId = USER
    clerkClientMock.users.updateUser.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    })
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ firstName: 'John' })
    expect(res.status).toBe(200)
    expect(clerkClientMock.users.updateUser).toHaveBeenCalledWith(USER, { firstName: 'John' })
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({ firstName: 'John' })
    expect(callArgs.data).not.toHaveProperty('lastName')
    expect(callArgs.data).not.toHaveProperty('email')
  })

  it('updates multiple fields when provided', async () => {
    currentUserId = USER
    clerkClientMock.users.updateUser.mockResolvedValue({})
    clerkClientMock.users.replaceUserEmailAddress.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+972501234567',
      profilePic: 'https://example.com/photo.jpg',
    })
    const res = await request(app)
      .patch('/api/me/profile')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+972501234567',
        profilePic: 'https://example.com/photo.jpg',
      })
    expect(res.status).toBe(200)
    expect(clerkClientMock.users.updateUser).toHaveBeenCalledWith(USER, {
      firstName: 'John',
      lastName: 'Doe',
    })
    expect(clerkClientMock.users.replaceUserEmailAddress).toHaveBeenCalledWith(USER, {
      emailAddress: 'john@example.com',
    })
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+972501234567',
      profilePic: 'https://example.com/photo.jpg',
    })
  })

  it('400s when email format is invalid', async () => {
    currentUserId = USER
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Please enter a valid email address')
    expect(clerkClientMock.users.replaceUserEmailAddress).not.toHaveBeenCalled()
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

  it('502s and does NOT call Prisma when Clerk.updateUser fails', async () => {
    currentUserId = USER
    clerkClientMock.users.updateUser.mockRejectedValue(new Error('Clerk API error'))
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ firstName: 'John' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('Could not update your account, try again')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('502s and does NOT call Prisma when Clerk.replaceUserEmailAddress fails', async () => {
    currentUserId = USER
    clerkClientMock.users.replaceUserEmailAddress.mockRejectedValue(new Error('Clerk API error'))
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ email: 'new@example.com' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('Could not update your account, try again')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('409s with phone error when phone number is already taken', async () => {
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

  it('409s with email error when email is already taken', async () => {
    currentUserId = USER
    clerkClientMock.users.replaceUserEmailAddress.mockResolvedValue({})
    prismaMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      })
    )
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ email: 'taken@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('That email is already registered to another account')
  })

  it('404s when the user row is gone', async () => {
    currentUserId = USER
    clerkClientMock.users.updateUser.mockResolvedValue({})
    prismaMock.user.update.mockRejectedValue(recordNotFound())
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ firstName: 'John' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Account not found')
  })

  it('accepts profilePic from Clerk-hosted URL (already uploaded by client)', async () => {
    currentUserId = USER
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      profilePic: 'https://images.clerk.dev/oauth_google/img_abc123.jpg',
    })
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ profilePic: 'https://images.clerk.dev/oauth_google/img_abc123.jpg' })
    expect(res.status).toBe(200)
    // Clerk should NOT be called for profilePic
    expect(clerkClientMock.users.updateUser).not.toHaveBeenCalled()
    expect(clerkClientMock.users.replaceUserEmailAddress).not.toHaveBeenCalled()
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({ profilePic: 'https://images.clerk.dev/oauth_google/img_abc123.jpg' })
  })

  it('does not send undefined fields to Clerk or Prisma', async () => {
    currentUserId = USER
    clerkClientMock.users.updateUser.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({
      clerkId: USER,
      firstName: 'Jane',
    })
    const res = await request(app)
      .patch('/api/me/profile')
      .send({ firstName: 'Jane' })
    expect(res.status).toBe(200)
    // Verify Clerk only got firstName, not lastName
    expect(clerkClientMock.users.updateUser).toHaveBeenCalledWith(USER, { firstName: 'Jane' })
    expect(clerkClientMock.users.replaceUserEmailAddress).not.toHaveBeenCalled()
    // Verify Prisma only got firstName
    const callArgs = prismaMock.user.update.mock.calls[0][0]
    expect(callArgs.data).toEqual({ firstName: 'Jane' })
  })
})
