// Tests for G411-35's auto-close logic. Mocks Prisma — no real DB touched.
// Covers: send warning, close after warning + 14 days, do-nothing (not
// stale enough / friend already replied), the false-positive fix (an
// ordinary admin reply must NOT count as "already warned"), the
// fresh-recheck-inside-transaction skip (Sibling review TOCTOU fix), and
// the no-admin-account early return.

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

const { runAutoCloseCheck, sendNudge, AUTO_CLOSE_WARNING_TEXT } = await import('./autoClose.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock))
  prismaMock.user.findFirst.mockResolvedValue(ADMIN)
  // Default: the fresh in-transaction re-read agrees the request is still
  // WAITING_ON_USER, so a close proceeds unless a test says otherwise.
  prismaMock.request.findUnique.mockResolvedValue({ status: 'WAITING_ON_USER' })
})

describe('runAutoCloseCheck', () => {
  it('does nothing for a request inactive less than the warning window', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 1 * DAY_MS) }])
    prismaMock.message.findFirst.mockResolvedValue(null)

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('sends the warning once inactive 12+ days with no prior warning', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 13 * DAY_MS) }])
    prismaMock.message.findFirst.mockResolvedValue({ userId: FRIEND.clerkId, createdAt: new Date(Date.now() - 13 * DAY_MS) })

    await runAutoCloseCheck()

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: AUTO_CLOSE_WARNING_TEXT, requestId: 1, userId: ADMIN.clerkId },
    })
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('closes once 14+ days inactive since an already-sent warning', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 20 * DAY_MS) }])
    prismaMock.message.findFirst.mockResolvedValue({
      userId: ADMIN.clerkId,
      content: AUTO_CLOSE_WARNING_TEXT,
      createdAt: new Date(Date.now() - 14 * DAY_MS),
    })

    await runAutoCloseCheck()

    expect(prismaMock.request.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'CLOSED' } })
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('restarts the clock if the friend replied after the warning', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 20 * DAY_MS) }])
    // Friend's reply is the LAST message, one day ago — clock restarts from there.
    prismaMock.message.findFirst.mockResolvedValue({ userId: FRIEND.clerkId, createdAt: new Date(Date.now() - 1 * DAY_MS) })

    await runAutoCloseCheck()

    expect(prismaMock.request.update).not.toHaveBeenCalled()
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  // Sibling review finding: an ordinary admin reply (not the warning
  // text) must not be mistaken for "already warned" — otherwise a request
  // can auto-close with no warning ever having been sent.
  it('does NOT treat an ordinary admin reply as an already-sent warning', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 20 * DAY_MS) }])
    prismaMock.message.findFirst.mockResolvedValue({
      userId: ADMIN.clerkId,
      content: 'checking on this, give me a day',
      createdAt: new Date(Date.now() - 14 * DAY_MS),
    })

    await runAutoCloseCheck()

    // Not "already warned" — the real warning gets sent instead of closing outright.
    expect(prismaMock.request.update).not.toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: AUTO_CLOSE_WARNING_TEXT, requestId: 1, userId: ADMIN.clerkId },
    })
  })

  // Sibling review finding (TOCTOU): a concurrent write moved the request
  // off WAITING_ON_USER between the top-level findMany and this request's
  // turn in the loop — the fresh in-transaction re-read must block the close.
  it('skips the close if a fresh re-read shows the request left WAITING_ON_USER', async () => {
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 20 * DAY_MS) }])
    prismaMock.message.findFirst.mockResolvedValue({
      userId: ADMIN.clerkId,
      content: AUTO_CLOSE_WARNING_TEXT,
      createdAt: new Date(Date.now() - 14 * DAY_MS),
    })
    prismaMock.request.findUnique.mockResolvedValue({ status: 'WORKING_ON_IT' })

    await runAutoCloseCheck()

    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })

  it('does nothing (no crash) if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.request.findMany.mockResolvedValue([{ id: 1, createdAt: new Date(Date.now() - 20 * DAY_MS) }])

    await runAutoCloseCheck()

    expect(prismaMock.message.create).not.toHaveBeenCalled()
    expect(prismaMock.request.update).not.toHaveBeenCalled()
  })
})

describe('sendNudge', () => {
  it('creates a message authored as the admin account', async () => {
    prismaMock.message.create.mockResolvedValue({ id: 1 })

    await sendNudge(5)

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: AUTO_CLOSE_WARNING_TEXT, requestId: 5, userId: ADMIN.clerkId },
    })
  })

  it('uses a passed-in admin instead of looking one up again', async () => {
    prismaMock.message.create.mockResolvedValue({ id: 1 })
    const otherAdmin = { clerkId: 'user_admin2' }

    await sendNudge(5, otherAdmin)

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: AUTO_CLOSE_WARNING_TEXT, requestId: 5, userId: otherAdmin.clerkId },
    })
  })

  it('throws if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(sendNudge(5)).rejects.toThrow('No admin account found')
  })
})
