import { describe, it, expect } from 'vitest'
import { generatePublicId } from './publicId.js'

describe('generatePublicId', () => {
  it('returns a string', () => {
    const id = generatePublicId()
    expect(typeof id).toBe('string')
  })

  it('returns a base64url encoded string of reasonable length', () => {
    const id = generatePublicId()
    // 12 random bytes = 16 base64url chars (12 * 4 / 3)
    expect(id.length).toBe(16)
  })

  it('uses only base64url-safe characters', () => {
    const id = generatePublicId()
    // base64url: A-Z, a-z, 0-9, -, _
    // no: +, /, =
    expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true)
  })

  it('generates unique IDs on each call', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(generatePublicId())
    }
    // All 1000 should be unique
    expect(ids.size).toBe(1000)
  })
})
describe('CI falsifier throwaway', () => { it('deliberately fails', () => { expect(true).toBe(false) }) })
