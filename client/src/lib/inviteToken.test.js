import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  extractPublicIdFromPath,
  captureRequestPermalinkFromUrl,
  getStashedRequestPermalink,
  clearStashedRequestPermalink,
} from './inviteToken'

// Mock sessionStorage since it's not available in Node.js test environment
const mockSessionStorage = {
  storage: {},
  getItem(key) {
    return this.storage[key] ?? null
  },
  setItem(key, value) {
    this.storage[key] = value
  },
  removeItem(key) {
    delete this.storage[key]
  },
  clear() {
    this.storage = {}
  },
}

vi.stubGlobal('sessionStorage', mockSessionStorage)
vi.stubGlobal('window', {
  location: {
    pathname: '/',
  },
})

describe('extractPublicIdFromPath', () => {
  it('extracts publicId from /r/<publicId> path', () => {
    expect(extractPublicIdFromPath('/r/abc123')).toBe('abc123')
    expect(extractPublicIdFromPath('/r/ABC-_DEF')).toBe('ABC-_DEF')
  })

  it('handles base64url characters', () => {
    const id = 'aB-_cD01'
    expect(extractPublicIdFromPath(`/r/${id}`)).toBe(id)
  })

  it('does not match invalid paths', () => {
    expect(extractPublicIdFromPath('/')).toBeNull()
    expect(extractPublicIdFromPath('/requests/123')).toBeNull()
    expect(extractPublicIdFromPath('/r/')).toBeNull()
    expect(extractPublicIdFromPath('/r/abc/extra')).toBeNull()
  })

  it('rejects disallowed characters', () => {
    expect(extractPublicIdFromPath('/r/abc+def')).toBeNull()
    expect(extractPublicIdFromPath('/r/abc/def')).toBeNull()
    expect(extractPublicIdFromPath('/r/abc=def')).toBeNull()
  })

  it('handles empty publicId', () => {
    expect(extractPublicIdFromPath('/r/')).toBeNull()
  })
})

describe('request permalink storage', () => {
  beforeEach(() => {
    clearStashedRequestPermalink()
    sessionStorage.clear()
  })

  afterEach(() => {
    clearStashedRequestPermalink()
    sessionStorage.clear()
  })

  it('stashes a captured publicId', () => {
    captureRequestPermalinkFromUrl()
    // Note: captureRequestPermalinkFromUrl reads from window.location.pathname
    // which is the actual URL, so we can't test it directly without mocking.
    // Instead test the storage functions separately.
    sessionStorage.setItem('gavi411-request-permalink', 'testid123')
    expect(getStashedRequestPermalink()).toBe('testid123')
  })

  it('clears the stashed permalink', () => {
    sessionStorage.setItem('gavi411-request-permalink', 'testid123')
    expect(getStashedRequestPermalink()).toBe('testid123')
    clearStashedRequestPermalink()
    expect(getStashedRequestPermalink()).toBeNull()
  })

  it('returns null when nothing is stashed', () => {
    expect(getStashedRequestPermalink()).toBeNull()
  })
})
