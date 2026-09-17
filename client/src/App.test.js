import { describe, it, expect } from 'vitest'

// Pure function to test the gate for permalink consumption
// Extracted so it can be tested independently of React state
export function canConsumePermalink(state) {
  const { isSignedIn, tokenHandoffDone, role, needsProfileCompletion, recoveryToken } = state
  return isSignedIn && tokenHandoffDone && role !== null && !needsProfileCompletion && !recoveryToken
}

describe('canConsumePermalink', () => {
  const baseState = {
    isSignedIn: true,
    tokenHandoffDone: true,
    role: 'USER',
    needsProfileCompletion: false,
    recoveryToken: null,
  }

  it('returns true when all conditions are met', () => {
    expect(canConsumePermalink(baseState)).toBe(true)
  })

  it('returns false when not signed in', () => {
    expect(canConsumePermalink({ ...baseState, isSignedIn: false })).toBe(false)
  })

  it('returns false when token handoff not done', () => {
    expect(canConsumePermalink({ ...baseState, tokenHandoffDone: false })).toBe(false)
  })

  it('returns false when role is null', () => {
    expect(canConsumePermalink({ ...baseState, role: null })).toBe(false)
  })

  it('returns false when profile completion needed', () => {
    expect(canConsumePermalink({ ...baseState, needsProfileCompletion: true })).toBe(false)
  })

  it('returns false when recovery token is set', () => {
    expect(canConsumePermalink({ ...baseState, recoveryToken: 'some-token' })).toBe(false)
  })

  it('returns true for admin role too', () => {
    expect(canConsumePermalink({ ...baseState, role: 'ADMIN' })).toBe(true)
  })

  it('returns false when multiple conditions fail', () => {
    expect(
      canConsumePermalink({
        ...baseState,
        isSignedIn: false,
        needsProfileCompletion: true,
      })
    ).toBe(false)
  })
})
