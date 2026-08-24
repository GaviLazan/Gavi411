// Tests for word-boundary keyword matching (G411-63).
// Mocks Prisma's Trigger table — no real DB touched.

import { describe, it, expect, vi } from 'vitest'

const triggers = [
  { keyword: 'light', requestType: 'TECH_SUPPORT' },
  { keyword: 'flight', requestType: 'TRAVEL' },
  { keyword: 'go to', requestType: 'TRAVEL' },
  { keyword: 'rental car', requestType: 'TRAVEL' },
  { keyword: 'buy', requestType: 'PURCHASE' },
]

const prismaMock = {
  trigger: { findMany: vi.fn(() => Promise.resolve(triggers)) },
}

vi.mock('./prisma.js', () => ({ prisma: prismaMock }))

const { matchKeywords } = await import('./matchKeywords.js')

describe('matchKeywords', () => {
  it('does NOT match "light" inside "flights" (the false-positive case named in G411-63)', async () => {
    const result = await matchKeywords('booking flights for our trip')
    expect(result).not.toContain('TECH_SUPPORT')
  })

  it('a short keyword does not match as a mid-word substring elsewhere', async () => {
    const result = await matchKeywords('I am buying a new phone case')
    // 'buy' is a substring of 'buying' — must NOT match after the word-boundary fix.
    expect(result).not.toContain('PURCHASE')
  })

  it('matches a real whole-word keyword', async () => {
    const result = await matchKeywords('need to buy a gift')
    expect(result).toEqual(['PURCHASE'])
  })

  it('matches a multi-word keyword phrase', async () => {
    const result = await matchKeywords('where should we go to for vacation')
    expect(result).toEqual(['TRAVEL'])
  })

  it('does not match a multi-word keyword when words are not adjacent/contiguous', async () => {
    const result = await matchKeywords('goto the store, not going anywhere')
    expect(result).toEqual([])
  })

  it('matches "rental car" as a phrase, not as split words', async () => {
    const result = await matchKeywords('I need a rental car this weekend')
    expect(result).toEqual(['TRAVEL'])
  })

  it('is case-insensitive', async () => {
    const result = await matchKeywords('BUY me something nice')
    expect(result).toEqual(['PURCHASE'])
  })

  it('matches correctly inside mixed Hebrew/English text', async () => {
    const result = await matchKeywords('אני צריך לקנות ו to buy דברים')
    expect(result).toEqual(['PURCHASE'])
  })

  it('matches nothing in Hebrew-only text with no seeded keyword present', async () => {
    const result = await matchKeywords('אני רוצה לנסוע לחופשה')
    expect(result).toEqual([])
  })
})
