// Tests for the CSV row-building logic (G411-28 stage 4). downloadInviteCsv
// itself isn't tested — it's a thin Blob/DOM side-effect wrapper, same
// DOM-avoidance convention as keyStore.js.
import { describe, it, expect } from 'vitest'
import { inviteCsvRow } from './inviteCsv.js'

describe('inviteCsvRow', () => {
  it('produces exactly one row, no header — username/website/password/notes', () => {
    const csv = inviteCsvRow({ label: 'Dana', passphrase: 'abc123', token: 'tok' })
    expect(csv.includes('\r\n')).toBe(false)
    expect(csv).toBe('Dana,Gavi411,abc123,')
  })

  it('falls back to an empty username when there is no label', () => {
    const csv = inviteCsvRow({ label: null, passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe(',Gavi411,abc123,')
  })

  it('quotes and escapes a label containing a comma', () => {
    const csv = inviteCsvRow({ label: 'Dana, from work', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('"Dana, from work",Gavi411,abc123,')
  })

  it('quotes and doubles embedded quotes', () => {
    const csv = inviteCsvRow({ label: 'Dana "the friend"', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('"Dana ""the friend""",Gavi411,abc123,')
  })

  it('handles bidi (Hebrew) labels without corrupting the CSV structure', () => {
    const csv = inviteCsvRow({ label: 'דנה', passphrase: 'abc123', token: 'tok' })
    expect(csv).toBe('דנה,Gavi411,abc123,')
  })
})
