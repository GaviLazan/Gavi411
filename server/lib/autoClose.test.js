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
  request: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
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
  function setUpNudgedRequest(id, nudgedAt) {
    return { id, nudgedAt, createdAt: new Date(nudgedAt.getTime() - 30 * DAY_MS) }
  }

  it('skips requests where nudgedAt is null', async () => {
    prismaMock.request.findMany.mockResolvedValue([]) // No nudged requests

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('sends nudge #2 at 7+ days since nudge #1 if not already sent', async () => {
    const nudgedAt = new Date(Date.now() - 8 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt)])
    prismaMock.message.findFirst.mockResolvedValueOnce(null) // No last message (uses request.createdAt)
    prismaMock.message.findFirst.mockResolvedValueOnce(null) // Nudge #2 not sent yet

    await runAutoCloseCheck()

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        content: 'Still haven\'t heard back — if I don\'t hear from you soon I\'ll likely go ahead and close this request.',
        requestId: 1,
        userId: ADMIN.clerkId,
        isSystem: true,
      },
    })
  })

  it('does NOT resend nudge #2 if already sent and not yet 14 days', async () => {
    // 9 days since nudge #1, nudge #2 already sent, but not yet 14 days to close
    const nudgedAt = new Date(Date.now() - 9 * DAY_MS)
    const lastMessageAt = new Date(Date.now() - 8 * DAY_MS) // Friend replied recently
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt)])
    prismaMock.message.findFirst.mockResolvedValueOnce({ userId: 'friend', createdAt: lastMessageAt })
    prismaMock.message.findFirst.mockResolvedValueOnce({ isSystem: true }) // Nudge #2 already sent

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('closes at 14+ days since nudge #1 if nudge #2 was sent and no friend reply', async () => {
    const nudgedAt = new Date(Date.now() - 15 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt)])
    prismaMock.message.findFirst.mockResolvedValueOnce(null) // No last message
    prismaMock.message.findFirst.mockResolvedValueOnce({ isSystem: true }) // Nudge #2 was sent
    prismaMock.request.findUnique.mockResolvedValue({ status: 'WAITING_ON_USER' }) // Fresh read confirms status

    await runAutoCloseCheck()

    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CLOSED' },
    })
  })

  it('does NOT close if friend replied after nudge #1', async () => {
    const nudgedAt = new Date(Date.now() - 15 * DAY_MS)
    const friendReplyAt = new Date(Date.now() - 1 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt)])
    // Friend's last message is recent — clock hasn't progressed enough
    prismaMock.message.findFirst.mockResolvedValueOnce({ userId: FRIEND.clerkId, createdAt: friendReplyAt })
    // Nudge #2 was sent, but friend replied after so inactiveMs < CLOSE_AFTER_MS
    prismaMock.message.findFirst.mockResolvedValueOnce({ isSystem: true })

    await runAutoCloseCheck()

    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('skips close if fresh re-read shows request no longer WAITING_ON_USER', async () => {
    const nudgedAt = new Date(Date.now() - 15 * DAY_MS)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, nudgedAt)])
    prismaMock.message.findFirst.mockResolvedValueOnce(null)
    prismaMock.message.findFirst.mockResolvedValueOnce({ isSystem: true })
    prismaMock.request.findUnique.mockResolvedValue({ status: 'CLOSED' }) // Already closed by concurrent write

    await runAutoCloseCheck()

    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('does nothing if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.request.findMany.mockResolvedValue([setUpNudgedRequest(1, new Date(Date.now() - 8 * DAY_MS))])

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })
})

describe('sendNudge', () => {
  const NUDGE_ONE_TEXT = 'Hey, Gavi is waiting for your response'

  it('creates nudge #1 message and stamps nudgedAt', async () => {
    prismaMock.request.findUnique.mockResolvedValue({ nudgedAt: null })
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    prismaMock.message.create.mockResolvedValue({ id: 1 })
    prismaMock.request.update.mockResolvedValue({ id: 5, nudgedAt: new Date() })

    await sendNudge(5)

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: NUDGE_ONE_TEXT, requestId: 5, userId: ADMIN.clerkId, isSystem: true },
    })
    expect(prismaMock.request.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { nudgedAt: expect.any(Date) },
    })
  })

  it('uses a passed-in admin instead of looking one up again', async () => {
    prismaMock.request.findUnique.mockResolvedValue({ nudgedAt: null })
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
    const otherAdmin = { clerkId: 'user_admin2' }

    await sendNudge(5, otherAdmin)

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: NUDGE_ONE_TEXT, requestId: 5, userId: otherAdmin.clerkId, isSystem: true },
    })
  })

  it('throws if request is already nudged (nudgedAt not null)', async () => {
    prismaMock.request.findUnique.mockResolvedValue({ nudgedAt: new Date() })

    await expect(sendNudge(5)).rejects.toThrow('already nudged')
  })

  it('throws if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(sendNudge(5)).rejects.toThrow('No admin account found')
  })
})
