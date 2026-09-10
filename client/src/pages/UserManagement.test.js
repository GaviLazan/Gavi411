// Tests for the credit-adjustment input parsing (Gavi's ask: type a
// target balance by default, or an explicit +N/-N delta).

import { describe, it, expect } from 'vitest'
import { creditInputToDelta } from './UserManagement'

describe('creditInputToDelta', () => {
  it('treats a plain number as a target balance, not a delta', () => {
    expect(creditInputToDelta('12', 5)).toBe(7)
    expect(creditInputToDelta('0', 5)).toBe(-5)
  })

  it('treats a leading + or - as an explicit delta', () => {
    expect(creditInputToDelta('+5', 5)).toBe(5)
    expect(creditInputToDelta('-2', 5)).toBe(-2)
  })

  it('returns 0 for empty or non-numeric input', () => {
    expect(creditInputToDelta('', 5)).toBe(0)
    expect(creditInputToDelta('   ', 5)).toBe(0)
    expect(creditInputToDelta('abc', 5)).toBe(0)
  })
})
