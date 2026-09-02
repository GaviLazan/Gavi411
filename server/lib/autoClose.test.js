// Tests for G411-35's auto-close logic. Mocks Prisma — no real DB touched.
// Covers the three real branches: send warning, close after warning +
// 14 days, and do-nothing (not stale enough yet, or friend already
// replied since the warning).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000
const ADMIN = { clerkId: 'user_admin', role: 'ADMIN', createdAt: new Date(0) }
const FRIEND = { clerkId: 'user_friend' }

const prismaMock = {
  request: { findMany: vi.fn(), update: vi.fn() },
  message: { findFirst: vi.fn(), create: vi.fn() },
  user: { findFirst: vi.fn() },
}

vi.mock('./prisma.js', () => ({ prisma: prismaMock }))

const { runAutoCloseCheck, sendNudge, AUTO_CLOSE_WARNING_TEXT } = await import('./autoClose.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue(ADMIN)
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
    prismaMock.message.findFirst.mockResolvedValue({ userId: ADMIN.clerkId, createdAt: new Date(Date.now() - 14 * DAY_MS) })

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
})

describe('sendNudge', () => {
  it('creates a message authored as the admin account', async () => {
    prismaMock.message.create.mockResolvedValue({ id: 1 })

    await sendNudge(5)

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: { content: AUTO_CLOSE_WARNING_TEXT, requestId: 5, userId: ADMIN.clerkId },
    })
  })

  it('throws if no admin account exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(sendNudge(5)).rejects.toThrow('No admin account found')
  })
})
