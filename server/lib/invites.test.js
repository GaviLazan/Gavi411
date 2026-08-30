// Tests for claimInvite/linkClaimedInvite/unclaimInvite/isInviteValid
// (G411-81 Sibling review finding — this file exists specifically
// because the old read-then-write check in requireAuth raced against
// its own later claim; these functions are the single source of truth
// both auth.js and routes/invites.js now share). Mocks Prisma — no real
// DB touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateMany = vi.fn()
const mockFindUnique = vi.fn()

vi.mock('./prisma.js', () => ({
  prisma: {
    pendingInvite: {
      updateMany: (...args) => mockUpdateMany(...args),
      findUnique: (...args) => mockFindUnique(...args),
    },
  },
}))

const { claimInvite, linkClaimedInvite, unclaimInvite, isInviteValid } = await import('./invites.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('claimInvite', () => {
  it('returns false immediately for a falsy token, no DB call', async () => {
    const result = await claimInvite(null)
    expect(result).toBe(false)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('claims successfully and returns true when the update affects one row', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const result = await claimInvite('tok123')

    expect(result).toBe(true)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { token: 'tok123', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('returns false when the update affects zero rows (invalid/already-used)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const result = await claimInvite('tok123')

    expect(result).toBe(false)
  })

  // The actual bug this file fixes: two concurrent requests for the SAME
  // token used to both pass a read-only check before either claimed it.
  // The WHERE clause here (usedAt: null) IS the check — a second call
  // can never match once the first has set usedAt, no separate read
  // involved, so there's no window between "checked valid" and "claimed".
  it('a second call for the same token fails once the first has claimed it', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 }) // first call claims
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }) // second can't

    const first = await claimInvite('tok123')
    const second = await claimInvite('tok123')

    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('does NOT set usedByUserId (no FK column touched in phase 1 — would violate the FK before the User row exists)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await claimInvite('tok123')

    const call = mockUpdateMany.mock.calls[0][0]
    expect(call.data).not.toHaveProperty('usedByUserId')
  })
})

describe('linkClaimedInvite', () => {
  it('no-ops for a falsy token', async () => {
    await linkClaimedInvite(null, 'user_1')
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('sets usedByUserId only if it is still null (safe to call more than once)', async () => {
    await linkClaimedInvite('tok123', 'user_1')

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { token: 'tok123', usedByUserId: null },
      data: { usedByUserId: 'user_1' },
    })
  })
})

describe('unclaimInvite', () => {
  it('no-ops for a falsy token', async () => {
    await unclaimInvite(null)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('releases usedAt only if usedByUserId is still null (never actually linked to a user)', async () => {
    await unclaimInvite('tok123')

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { token: 'tok123', usedByUserId: null },
      data: { usedAt: null },
    })
  })
})

describe('isInviteValid', () => {
  it('returns false for a falsy token, no DB call', async () => {
    const result = await isInviteValid(null)
    expect(result).toBe(false)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('true for an existing, unused invite', async () => {
    mockFindUnique.mockResolvedValue({ token: 'tok123', usedAt: null })
    expect(await isInviteValid('tok123')).toBe(true)
  })

  it('false for a used invite', async () => {
    mockFindUnique.mockResolvedValue({ token: 'tok123', usedAt: new Date() })
    expect(await isInviteValid('tok123')).toBe(false)
  })

  it('false for a token that does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await isInviteValid('nonexistent')).toBe(false)
  })
})
