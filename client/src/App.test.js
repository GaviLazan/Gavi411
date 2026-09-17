import { describe, it, expect } from 'vitest'
import { canConsumeRequestPermalink } from './lib/inviteToken'

describe('canConsumeRequestPermalink', () => {
  const baseState = {
    isSignedIn: true,
    tokenHandoffDone: true,
    role: 'USER',
    isAdmin: false,
    needsProfileCompletion: false,
    recoveryToken: null,
  }

  it('returns true when all conditions are met', () => {
    expect(canConsumeRequestPermalink(baseState)).toBe(true)
  })

  it('returns false when not signed in', () => {
    expect(canConsumeRequestPermalink({ ...baseState, isSignedIn: false })).toBe(false)
  })

  it('returns false when token handoff not done', () => {
    expect(canConsumeRequestPermalink({ ...baseState, tokenHandoffDone: false })).toBe(false)
  })

  it('returns false when role is null', () => {
    expect(canConsumeRequestPermalink({ ...baseState, role: null })).toBe(false)
  })

  it('returns false for a non-admin who still needs profile completion', () => {
    expect(canConsumeRequestPermalink({ ...baseState, needsProfileCompletion: true })).toBe(false)
  })

  it('returns true for admin even if needsProfileCompletion is true (pending- placeholder is permanent for admin)', () => {
    expect(
      canConsumeRequestPermalink({
        ...baseState,
        role: 'ADMIN',
        isAdmin: true,
        needsProfileCompletion: true,
      })
    ).toBe(true)
  })

  it('returns false when recovery token is set', () => {
    expect(canConsumeRequestPermalink({ ...baseState, recoveryToken: 'some-token' })).toBe(false)
  })

  it('returns true for admin role too, profile already complete', () => {
    expect(canConsumeRequestPermalink({ ...baseState, role: 'ADMIN', isAdmin: true })).toBe(true)
  })

  it('returns false when multiple conditions fail', () => {
    expect(
      canConsumeRequestPermalink({
        ...baseState,
        isSignedIn: false,
        needsProfileCompletion: true,
      })
    ).toBe(false)
  })
})
