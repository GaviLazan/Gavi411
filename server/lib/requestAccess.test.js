import { describe, it, expect, vi } from 'vitest'
import { canAccessRequest, hasAdminMessaged } from './requestAccess.js'

describe('canAccessRequest', () => {
  it('allows the owner', () => {
    expect(canAccessRequest({ userId: 'u1' }, { clerkId: 'u1', role: 'USER' })).toBe(true)
  })

  it('allows an admin regardless of ownership', () => {
    expect(canAccessRequest({ userId: 'u1' }, { clerkId: 'u2', role: 'ADMIN' })).toBe(true)
  })

  it('denies a non-owner, non-admin', () => {
    expect(canAccessRequest({ userId: 'u1' }, { clerkId: 'u2', role: 'USER' })).toBe(false)
  })
})

describe('hasAdminMessaged (G411-31, G411-93)', () => {
  it('true when a REAL ADMIN-role message exists on the request', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } }
    expect(await hasAdminMessaged(db, 42)).toBe(true)
    expect(db.message.findFirst).toHaveBeenCalledWith({
      where: { requestId: 42, user: { role: 'ADMIN' }, isSystem: false },
    })
  })

  it('false when no ADMIN-role message exists', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue(null) } }
    expect(await hasAdminMessaged(db, 42)).toBe(false)
  })

  // G411-93 (and earlier G411-35/36): system messages (nudges #1 and #2,
  // marked with isSystem: true) are authored as admin but must NOT count as
  // real admin replies for refund-eligibility purposes — a friend who only
  // got automated nudges should still get their G411-31 refund on cancel.
  it('excludes system messages (nudges) from the check', async () => {
    const db = { message: { findFirst: vi.fn() } }
    await hasAdminMessaged(db, 42)
    const where = db.message.findFirst.mock.calls[0][0].where
    expect(where.isSystem).toBe(false)
  })

  it('returns false if only system messages exist (friend only got nudges, no real admin reply)', async () => {
    const db = {
      message: {
        findFirst: vi.fn().mockResolvedValue(null), // No non-system admin messages
      },
    }
    expect(await hasAdminMessaged(db, 42)).toBe(false)
  })
})
