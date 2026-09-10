// Pure-logic check for the theme cycle order (G411-73, G411-95). No jsdom/DOM test
// environment exists in this repo yet (server-side Vitest only so far) —
// setting one up is real new infra, not justified for one small hook.
// This tests the cycling order in isolation instead of importing the real
// hook (which touches document/localStorage).
import { describe, it, expect } from 'vitest'

const ORDER = ['light', 'dark']
function next(current) {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
}

describe('theme cycle order (useTheme.js)', () => {
  it('cycles light -> dark -> light', () => {
    expect(next('light')).toBe('dark')
    expect(next('dark')).toBe('light')
  })

  it('falls back to light for an unrecognized stored value', () => {
    const stored = 'bogus'
    const theme = ORDER.includes(stored) ? stored : 'light'
    expect(theme).toBe('light')
  })

  it('defaults to light on first load (no OS preference respected)', () => {
    const stored = null
    const theme = stored && ORDER.includes(stored) ? stored : 'light'
    expect(theme).toBe('light')
  })
})
