// Tests for the CSV row-building logic (G411-28 stage 4). downloadInviteCsv
// itself isn't tested — it's a thin Blob/DOM side-effect wrapper, same
// DOM-avoidance convention as keyStore.js.
import { describe, it, expect } from 'vitest'
import { inviteCsvRow } from './inviteCsv.js'

describe('inviteCsvRow', () => {
  it('produces a header row plus one data row with title/passphrase/notes', () => {
    const csv = inviteCsvRow({ label: 'Dana', passphrase: 'abc123', token: 'tok' })
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('title,passphrase,notes')
    expect(lines[1]).toBe('Dana,abc123,')
  })

  it('falls back to an empty title when there is no label', () => {
    const csv = inviteCsvRow({ label: null, passphrase: 'abc123', token: 'tok' })
    expect(csv.split('\r\n')[1]).toBe(',abc123,')
  })

  it('quotes and escapes a label containing a comma', () => {
    const csv = inviteCsvRow({ label: 'Dana, from work', passphrase: 'abc123', token: 'tok' })
    expect(csv.split('\r\n')[1]).toBe('"Dana, from work",abc123,')
  })

  it('quotes and doubles embedded quotes', () => {
    const csv = inviteCsvRow({ label: 'Dana "the friend"', passphrase: 'abc123', token: 'tok' })
    expect(csv.split('\r\n')[1]).toBe('"Dana ""the friend""",abc123,')
  })

  it('handles bidi (Hebrew) labels without corrupting the CSV structure', () => {
    const csv = inviteCsvRow({ label: 'דנה', passphrase: 'abc123', token: 'tok' })
    expect(csv.split('\r\n')[1]).toBe('דנה,abc123,')
  })
})
