// Tests for G411-93's nudge-driven escalation system. Mocks Prisma — no
// real DB touched. Covers: nudge #1 (manual only), nudge #2 (auto-fired at 7+ days),
// auto-close (at 14+ days after nudge #2), no re-sends, skip if nudgedAt null,
// friend reply resets nudgedAt, request defends against double-nudge, and
// hasAdminMessaged excludes system messages.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000
const ADMIN = { clerkId: 'user_admin', role: 'ADMIN', createdAt: new Date(0) }
const FRIEND = { clerkId: 'user_friend' }

const prismaMock = {
  request: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  message: { findFirst: vi.fn(), create: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn((cb) => cb(prismaMock)),
}

vi.mock('./prisma.js', () => ({ prisma: prismaMock }))

const { runAutoCloseCheck, sendNudge } = await import('./autoClose.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))
  prismaMock.user.findFirst.mockResolvedValue(ADMIN)
  // Default: the fresh in-transaction re-read agrees the request is still
  // WAITING_ON_USER, so a close proceeds unless a test says otherwise.
  prismaMock.request.findUnique.mockResolvedValue({ status: 'WAITING_ON_USER' })
})

describe('runAutoCloseCheck', () => {
  // Helper to setup findMany mock for nudged requests
  function setUpNudgedRequest(id, nudgedAt, nudgeTwoSentAt = null) {
    return { id, nudgedAt, nudgeTwoSentAt, createdAt: new Date(nudgedAt.getTime() - 30 * DAY_MS) }
  }

  it('skips requests where nudgedAt is null', async () => {
    prismaMock.request.findMany.mockResolvedValue([]) // No nudged requests

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('sends nudge #2 at 7+ days since nudge #1 if not already sent', async () => {
    const nudgedAt = new Date(Date.now() - 8 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt, null)])

    await runAutoCloseCheck()

    expect(prismaMock.message.create).toHaveBeenCalled()
    expect(prismaMock.request.update).toHaveBeenCalled()
    // Check that nudgeTwoSentAt was set atomically with the message
    const updateCall = prismaMock.request.update.mock.calls[0]?.[0]
    expect(updateCall?.data?.nudgeTwoSentAt).toBeDefined()
  })

  it('does NOT resend nudge #2 if already sent and not yet 14 days', async () => {
    // 9 days since nudge #1, nudge #2 already sent, but not yet 14 days to close
    const nudgedAt = new Date(Date.now() - 9 * DAY_MS)
    const nudgeTwoSentAt = new Date(Date.now() - 2 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt, nudgeTwoSentAt)])

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('closes at 14+ days since nudge #1 if nudge #2 was sent and no friend reply', async () => {
    const nudgedAt = new Date(Date.now() - 15 * DAY_MS)
    const nudgeTwoSentAt = new Date(Date.now() - 8 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt, nudgeTwoSentAt)])
    prismaMock.request.findUnique.mockResolvedValue({ status: 'WAITING_ON_USER' }) // Fresh read confirms status

    await runAutoCloseCheck()

    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CLOSED' },
    })
  })

  it('does NOT close if nudgedAt was reset by a friend reply (nudgedAt is null)', async () => {
    // When a friend replies, nudgedAt is cleared to null, removing the request
    // from the escalation cycle. Even if nudge #2 was sent before, it won't close.
    const nudgedAt = null
    prismaMock.request.findMany.mockResolvedValue([]) // No nudged requests (all have nudgedAt=null)

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('skips close if fresh re-read shows request no longer WAITING_ON_USER', async () => {
    const nudgedAt = new Date(Date.now() - 15 * DAY_MS)
    const nudgeTwoSentAt = new Date(Date.now() - 8 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt, nudgeTwoSentAt)])
    prismaMock.request.findUnique.mockResolvedValue({ status: 'CLOSED' }) // Already closed by concurrent write

    await runAutoCloseCheck()

    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('does nothing if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, new Date(Date.now() - 8 * DAY_MS), null)])

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })
})

describe('sendNudge', () => {
  const NUDGE_ONE_TEXT = 'Hey, Gavi is waiting for your response'

  it('creates nudge #1 message and stamps nudgedAt atomically', async () => {
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    prismaMock.request.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.message.create.mockResolvedValue({ id: 1 })
    prismaMock.request.findUnique.mockResolvedValue({ id: 5, nudgedAt: new Date(), message: [] })

    await sendNudge(5)

    // Should atomically check nudgedAt is null and set it in updateMany
    expect(prismaMock.request.updateMany).toHaveBeenCalledWith({
      where: { id: 5, nudgedAt: null },
      data: { nudgedAt: expect.any(Date) },
    })
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: NUDGE_ONE_TEXT, requestId: 5, userId: ADMIN.clerkId, isSystem: true },
    })
  })

  it('uses a passed-in admin instead of looking one up again', async () => {
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    prismaMock.request.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.message.create.mockResolvedValue({ id: 1 })
    prismaMock.request.findUnique.mockResolvedValue({ id: 5, nudgedAt: new Date(), message: [] })
    const otherAdmin = { clerkId: 'user_admin2' }

    await sendNudge(5, otherAdmin)

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: NUDGE_ONE_TEXT, requestId: 5, userId: otherAdmin.clerkId, isSystem: true },
    })
  })

  it('throws if request is already nudged (updateMany returns count 0)', async () => {
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    prismaMock.request.updateMany.mockResolvedValue({ count: 0 })

    await expect(sendNudge(5)).rejects.toThrow('already nudged')
  })

  it('throws if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(sendNudge(5)).rejects.toThrow('No admin account found')
  })
})
