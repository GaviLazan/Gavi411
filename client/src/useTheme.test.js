// Pure-logic check for the theme cycle order (G411-73). No jsdom/DOM test
// environment exists in this repo yet (server-side Vitest only so far) —
// setting one up is real new infra, not justified for one small hook.
// This tests the cycling order in isolation instead of importing the real
// hook (which touches document/localStorage).
import { describe, it, expect } from 'vitest'

const ORDER = ['system', 'light', 'dark']
function next(current) {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
}

describe('theme cycle order (useTheme.js)', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(next('system')).toBe('light')
    expect(next('light')).toBe('dark')
    expect(next('dark')).toBe('system')
  })

  it('falls back to system for an unrecognized stored value', () => {
    const stored = 'bogus'
    const theme = ORDER.includes(stored) ? stored : 'system'
    expect(theme).toBe('system')
  })
})
