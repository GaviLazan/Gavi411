import { describe, it, expect, vi } from 'vitest'
import { canAccessRequest, hasAdminMessaged, AUTO_CLOSE_WARNING_TEXT } from './requestAccess.js'

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

describe('hasAdminMessaged (G411-31)', () => {
  it('true when a REAL ADMIN-role message exists on the request', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } }
    expect(await hasAdminMessaged(db, 42)).toBe(true)
    expect(db.message.findFirst).toHaveBeenCalledWith({
      where: { requestId: 42, user: { role: 'ADMIN' }, content: { not: AUTO_CLOSE_WARNING_TEXT } },
    })
  })

  it('false when no ADMIN-role message exists', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue(null) } }
    expect(await hasAdminMessaged(db, 42)).toBe(false)
  })

  // Sibling review finding (G411-35/36): the auto-close job's automated
  // warning message is authored as admin but must NOT count as a real
  // admin reply for refund-eligibility purposes — a friend who only got
  // an automated nudge should still get their G411-31 refund on cancel.
  it('excludes the auto-close job\'s automated warning message from the check', async () => {
    const db = { message: { findFirst: vi.fn() } }
    await hasAdminMessaged(db, 42)
    const where = db.message.findFirst.mock.calls[0][0].where
    expect(where.content).toEqual({ not: AUTO_CLOSE_WARNING_TEXT })
  })
})
