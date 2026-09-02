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

describe('hasAdminMessaged (G411-31)', () => {
  it('true when an ADMIN-role message exists on the request', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) } }
    expect(await hasAdminMessaged(db, 42)).toBe(true)
    expect(db.message.findFirst).toHaveBeenCalledWith({
      where: { requestId: 42, user: { role: 'ADMIN' } },
    })
  })

  it('false when no ADMIN-role message exists', async () => {
    const db = { message: { findFirst: vi.fn().mockResolvedValue(null) } }
    expect(await hasAdminMessaged(db, 42)).toBe(false)
  })
})
