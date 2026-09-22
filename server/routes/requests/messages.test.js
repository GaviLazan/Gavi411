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

const DAY_MS = 24 * 60 * 60 * 1000

const usersByClerkId = {
  [OWNER]: { clerkId: OWNER, role: 'USER', publicKey: 'owner-pubkey' },
  [OTHER]: { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN', publicKey: 'admin-pubkey' },
}

// Swapped per-test via currentUserId to simulate different signed-in users.
let currentUserId = null

vi.mock('../../middleware/auth.js', () => ({
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
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  note: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  creditTransaction: {
    create: vi.fn(),
  },
  // $transaction just runs the callback with `prismaMock` itself as `tx` —
  // every mock above is reachable through either the top-level prisma
  // object or the tx passed to a transaction callback, so tests can assert
  // against the same vi.fn() either way.
  $transaction: vi.fn((cb) => cb(prismaMock)),
}

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../../lib/matchKeywords.js', () => ({ matchKeywords: vi.fn() }))

const uploadImageMock = vi.fn()
vi.mock('../../lib/cloudinary.js', async () => {
  const actual = await vi.importActual('../../lib/cloudinary.js')
  return { ...actual, uploadImage: (...args) => uploadImageMock(...args) }
})

// Real implementation by default (it operates on prismaMock as its `tx`
// arg, so existing tests asserting user.update/creditTransaction.create
// side effects still pass) — G411-44's tests spy on it per-test instead
// of replacing it wholesale, which broke every pre-existing deduction/
// refund assertion in this file (Sibling review finding).
vi.mock('../../lib/credits.js', async () => {
  const actual = await vi.importActual('../../lib/credits.js')
  return { ...actual }
})

vi.mock('../../lib/webPush.js', () => ({
  sendPushToUser: vi.fn(async () => undefined),
}))

vi.mock('../../lib/notify.js', () => ({
  notifyAdmins: vi.fn(async () => undefined),
  notifyUser: vi.fn(async () => undefined),
}))

const { default: requestsRouter } = await import('./index.js')

const app = express()
app.use(express.json())
app.use('/api/requests', requestsRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
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
      data: { content: 'hi', encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
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

// G411-34 — reopen-on-message
describe('POST /api/requests/:id/messages — reopen-on-message (G411-34)', () => {
  it('a friend message on a CLOSED request reopens it to IN_QUEUE', async () => {
    currentUserId = OWNER
    // G411-90: mock must include refundedAt (null for CLOSED, which was never refundable)
    // G411-93: also include nudgedAt and nudgeTwoSentAt (cleared when friend replies on reopenable)
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'CLOSED', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 7, content: 'still need help', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'still need help' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
  })

  it('an admin message on a CLOSED request reopens it to WAITING_ON_USER', async () => {
    currentUserId = ADMIN
    // G411-90: mock must include refundedAt (null for CLOSED)
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'CLOSED', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 8, content: 'one more thing', requestId: 1, userId: ADMIN })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'one more thing' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'WAITING_ON_USER' },
    })
  })

  it('a message on a non-reopenable request does not change status but clears nudgedAt and nudgeTwoSentAt if friend messaged (G411-93)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, status: 'WORKING_ON_IT' })
    prismaMock.message.create.mockResolvedValue({ id: 9, content: 'update', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'update' })

    expect(res.status).toBe(201)
    // Status should not change, but nudgedAt and nudgeTwoSentAt are cleared by friend message (G411-93)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nudgedAt: null, nudgeTwoSentAt: null },
    })
  })

  it('does not double-reopen if the request was already reopened by the time the transaction re-checks (Sibling review race fix)', async () => {
    currentUserId = OWNER
    // Pre-transaction read sees CLOSED (stale); the in-tx fresh re-read
    // sees it's already been reopened by a concurrent write — the second
    // reopen must not fire.
    // G411-90: both mocks must include refundedAt field
    prismaMock.request.findUnique
      .mockResolvedValueOnce({ ...sampleRequest, status: 'CLOSED', refundedAt: null })
      .mockResolvedValueOnce({ status: 'WAITING_ON_USER', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 10, content: 'hi again', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi again' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('a friend message on a reopenable request (CLOSED/CANCELLED/SELF_SOLVED) that had nudgedAt set clears it (G411-93)', async () => {
    // When a friend reopens a request that was previously in an
    // escalation cycle (nudgedAt was set), the reply should clear
    // nudgedAt to reset the cycle, same as replying to non-reopenable.
    currentUserId = OWNER
    const nudgedAt = new Date(Date.now() - 3 * DAY_MS)
    prismaMock.request.findUnique
      .mockResolvedValueOnce({ ...sampleRequest, status: 'CLOSED', refundedAt: null, nudgedAt })
      .mockResolvedValueOnce({ status: 'CLOSED', refundedAt: null })
    prismaMock.message.create.mockResolvedValue({ id: 11, content: 'need to reopen', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'need to reopen' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
  })
})

// G411-90 — reopen and recharge when refundedAt is set
describe('POST /api/requests/:id/messages — reopen with refund recharge (G411-90)', () => {
  it('reopens a CANCELLED request and charges 1 credit when it was refunded (refundedAt is set)', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: now,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 20, content: 'come back', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'come back' })

    expect(res.status).toBe(201)
    // Verify the update was called with status, refundedAt, and nudge fields cleared
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null },
    })
    // Verify credit was deducted
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: OWNER },
      data: { creditBalance: { decrement: 1 } },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })

  it('reopens a SELF_SOLVED request and charges 1 credit when it was refunded', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'SELF_SOLVED',
      refundedAt: now,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 21, content: 'update', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 3 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'update' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', refundedAt: null, nudgedAt: null, nudgeTwoSentAt: null },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })

  it('reopens a CANCELLED request WITHOUT charging when it was NOT refunded (refundedAt is null)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: null, // not refunded because admin had messaged
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 22, content: 'nevermind', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'nevermind' })

    expect(res.status).toBe(201)
    // Status changes, nudge fields cleared, no refundedAt update (it's already null)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
    // No credit deduction happened
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('reopens a CLOSED request and does NOT charge (CLOSED was never refundable, refundedAt stays null)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CLOSED',
      refundedAt: null,
      userId: OWNER,
      nudgedAt: null,
      nudgeTwoSentAt: null,
    })
    prismaMock.message.create.mockResolvedValue({ id: 23, content: 'back to this', requestId: 1, userId: OWNER })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'back to this' })

    expect(res.status).toBe(201)
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'IN_QUEUE', nudgedAt: null, nudgeTwoSentAt: null },
    })
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('402s when reopening would charge but balance is 0 (insufficient funds)', async () => {
    currentUserId = OWNER
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'SELF_SOLVED',
      refundedAt: now,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({ id: 24, content: 'try again', requestId: 1, userId: OWNER })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 0 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'try again' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('Insufficient credit balance')
    // Verify the status and refundedAt were NOT changed (transaction rolled back)
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('admin message on refunded CANCELLED reopens to WAITING_ON_USER and charges 1 credit', async () => {
    currentUserId = ADMIN
    const now = new Date()
    prismaMock.request.findUnique.mockResolvedValue({
      ...sampleRequest,
      status: 'CANCELLED',
      refundedAt: now,
      userId: OWNER,
    })
    prismaMock.message.create.mockResolvedValue({ id: 25, content: 'hi', requestId: 1, userId: ADMIN })
    prismaMock.user.findUnique.mockResolvedValue({ creditBalance: 2 })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })

    expect(res.status).toBe(201)
    // Admin reopens to WAITING_ON_USER
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'WAITING_ON_USER', refundedAt: null },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: OWNER },
    })
  })
})

describe('POST /api/requests/:id/messages — encrypted flag (G411-82)', () => {
  // Decision #98 pause: E2E_ENABLED=false, so this route now forces
  // encrypted: false regardless of what the client sends — see
  // e2eConfig.js. The client itself no longer sends encrypted:'true'
  // either (RequestDetail.jsx), but this is the structural backstop.
  it('forces encrypted: false even when the client sends encrypted="true" (E2E paused)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    const envelope = JSON.stringify({ iv: 'abc', ciphertext: 'def' })
    prismaMock.message.create.mockResolvedValue({ id: 9, content: envelope, encrypted: false })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: envelope, encrypted: 'true' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: envelope, encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
    })
  })

  it('defaults encrypted: false for a plain send (no flag, legacy behavior unchanged)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    prismaMock.message.create.mockResolvedValue({ id: 10, content: 'hi' })

    const res = await request(app).post('/api/requests/1/messages').send({ content: 'hi' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: 'hi', encrypted: false, imageUrl: null, requestId: 1, userId: OWNER },
    })
  })

  // Was a 400 pre-pause (a keyless sender can't have produced a real
  // envelope). With E2E_ENABLED=false the isEncrypted precondition never
  // even evaluates true, so a keyless sender's "encrypted" send just
  // lands as an ordinary plaintext message instead of being rejected.
  it('accepts a send from a keyless sender as plaintext (E2E paused, no key precondition)', async () => {
    currentUserId = OTHER // OTHER has a publicKey in this fixture — swap it out for this test
    const noKeyUser = { ...usersByClerkId[OTHER], publicKey: null }
    usersByClerkId[OTHER] = noKeyUser
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, userId: OTHER })
    prismaMock.message.create.mockResolvedValue({ id: 11, content: 'hi', encrypted: false })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: JSON.stringify({ iv: 'a', ciphertext: 'b' }), encrypted: 'true' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        content: JSON.stringify({ iv: 'a', ciphertext: 'b' }),
        encrypted: false,
        imageUrl: null,
        requestId: 1,
        userId: OTHER,
      },
    })
    usersByClerkId[OTHER] = { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' } // restore
  })

  // Sibling review finding (second round): the encrypted/publicKey check
  // used to run BEFORE the ownership check, so a non-owner sending
  // encrypted:true got a 400 about their own key status instead of this
  // router's deliberate 404 "Request not found" — leaking that the
  // encrypted-flag path exists (and their own key status) to someone who
  // shouldn't even be able to confirm the request exists.
  it('404s (not 400) for a non-owner, non-admin sender with no public key trying to send encrypted content', async () => {
    currentUserId = OTHER
    const noKeyUser = { ...usersByClerkId[OTHER], publicKey: null }
    usersByClerkId[OTHER] = noKeyUser
    // OWNER (not OTHER) owns this request — OTHER is a real signed-in
    // user, just not the owner and not an admin.
    prismaMock.request.findUnique.mockResolvedValue({ ...sampleRequest, userId: OWNER })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .send({ content: JSON.stringify({ iv: 'a', ciphertext: 'b' }), encrypted: 'true' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Request not found' })
    expect(prismaMock.message.create).not.toHaveBeenCalled()
    usersByClerkId[OTHER] = { clerkId: OTHER, role: 'USER', publicKey: 'other-pubkey' } // restore
  })
})

describe('POST /api/requests/:id/messages — image upload (G411-26)', () => {
  it('accepts an image with no caption (photo alone is a valid message)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    uploadImageMock.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg' })
    prismaMock.message.create.mockResolvedValue({ id: 7, content: '', imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg' })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(uploadImageMock).toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: '', encrypted: false, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/y.jpg', requestId: 1, userId: OWNER },
    })
  })

  it('accepts an image with a caption together (one message, both fields)', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    uploadImageMock.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x/image/upload/v1/z.jpg' })
    prismaMock.message.create.mockResolvedValue({ id: 8 })

    const res = await request(app)
      .post('/api/requests/1/messages')
      .field('content', 'here is a photo')
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: 'here is a photo', encrypted: false, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/z.jpg', requestId: 1, userId: OWNER },
    })
  })

  it('400s on a disallowed file type, never calls Cloudinary', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('400s on an oversized image, never calls Cloudinary', async () => {
    currentUserId = OWNER
    prismaMock.request.findUnique.mockResolvedValue(sampleRequest)
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1)

    const res = await request(app)
      .post('/api/requests/1/messages')
      .attach('image', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('400s when neither content nor an image is sent', async () => {
    currentUserId = OWNER
    const res = await request(app).post('/api/requests/1/messages').send({})
    expect(res.status).toBe(400)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })
})

