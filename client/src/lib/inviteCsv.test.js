// Tests for CSV row-building logic (no download side-effect testing).
import { describe, it, expect } from 'vitest'
import { inviteCsvRow } from './inviteCsv.js'

describe('inviteCsvRow', () => {
  it('produces exactly one row, no header — title/name/password/site', () => {
    const csv = inviteCsvRow({ label: 'Dana', passphrase: 'abc123', token: 'tok' })
    expect(csv.includes('\r\n')).toBe(false)
    expect(csv).toBe('Dana,Dana,abc123,Gavi411')
  })

  it('falls back to an empty title/name when there is no label', () => {
    const csv = inviteCsvRow({ label: null, passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe(',,abc123,Gavi411')
  })

  it('quotes and escapes a label containing a comma', () => {
    const csv = inviteCsvRow({ label: 'Dana, from work', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('"Dana, from work","Dana, from work",abc123,Gavi411')
  })

  it('quotes and doubles embedded quotes', () => {
    const csv = inviteCsvRow({ label: 'Dana "the friend"', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('"Dana ""the friend""","Dana ""the friend""",abc123,Gavi411')
  })

  it('handles bidi (Hebrew) labels without corrupting the CSV structure', () => {
    const csv = inviteCsvRow({ label: 'דנה', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('דנה,דנה,abc123,Gavi411')
  })
})
