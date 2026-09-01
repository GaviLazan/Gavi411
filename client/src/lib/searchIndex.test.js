// G411-28 admin client-side search index. Real Web Crypto + real
// decryptMessageContent (same convention as conversationCrypto.test.js),
// mocked fetch + keyStore.js so getConversationKey resolves a real shared
// key without hitting the network.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeypair, exportPublicKey, deriveSharedKey, encrypt } from './crypto.js'
import { _clearConversationKeyCacheForTests } from './conversationCrypto.js'

const mockLoadPrivateKey = vi.fn()
const mockLoadDeviceId = vi.fn()
vi.mock('./keyStore.js', () => ({
  loadPrivateKey: (...args) => mockLoadPrivateKey(...args),
  loadDeviceId: (...args) => mockLoadDeviceId(...args),
}))

const { buildSearchIndex, searchIndex } = await import('./searchIndex.js')

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  mockLoadDeviceId.mockResolvedValue(null)
  _clearConversationKeyCacheForTests()
})

describe('buildSearchIndex', () => {
  it('decrypts every request\'s messages into flat, searchable entries', async () => {
    const admin = await generateKeypair()
    const friend = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(admin.privateKey)
    const friendPublicB64 = await exportPublicKey(friend.publicKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ other: friendPublicB64 }) })

    const sharedKey = await deriveSharedKey(admin.privateKey, friend.publicKey)
    const envelope = await encrypt(sharedKey, 'the passport is in the drawer')

    const requests = [
      {
        id: 1,
        message: [{ id: 10, encrypted: true, content: JSON.stringify(envelope) }],
      },
    ]

    const entries = await buildSearchIndex(requests)

    expect(entries).toEqual([{ requestId: 1, messageId: 10, text: 'the passport is in the drawer' }])
  })

  it('includes legacy plaintext (encrypted: false) messages unchanged', async () => {
    const requests = [{ id: 2, message: [{ id: 20, encrypted: false, content: 'old plain message' }] }]

    const entries = await buildSearchIndex(requests)

    expect(entries).toEqual([{ requestId: 2, messageId: 20, text: 'old plain message' }])
  })

  it('skips requests with no messages', async () => {
    const entries = await buildSearchIndex([{ id: 3, message: [] }, { id: 4 }])
    expect(entries).toEqual([])
  })

  it('skips a message that fails to decrypt instead of throwing', async () => {
    mockLoadPrivateKey.mockResolvedValue(null) // no key at all -> getConversationKey resolves null
    const requests = [{ id: 5, message: [{ id: 50, encrypted: true, content: '{"iv":"x","ciphertext":"y"}' }] }]

    const entries = await buildSearchIndex(requests)

    expect(entries).toEqual([])
  })

  // Sibling review finding (PR #36): getConversationKey throwing outright
  // (a real network/WebCrypto exception, not just a non-ok response) used
  // to escape the per-message try/catch and abort buildSearchIndex
  // entirely — one bad request cost every other request's entries too.
  // Each request now runs independently via Promise.all, so a thrown
  // exception only costs that one request.
  it('isolates one request\'s getConversationKey exception — other requests still get indexed', async () => {
    const admin = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(admin.privateKey)

    fetch.mockImplementation((url) => {
      if (url === '/api/requests/6/public-keys') {
        return Promise.reject(new Error('network blip'))
      }
      return Promise.resolve({ ok: true, json: async () => ({ other: null }) })
    })

    const requests = [
      { id: 6, message: [{ id: 60, encrypted: true, content: '{"iv":"x","ciphertext":"y"}' }] },
      { id: 7, message: [{ id: 70, encrypted: false, content: 'plain and fine' }] },
    ]

    const entries = await buildSearchIndex(requests)

    expect(entries).toEqual([{ requestId: 7, messageId: 70, text: 'plain and fine' }])
  })
})

describe('searchIndex', () => {
  const entries = [
    { requestId: 1, messageId: 10, text: 'the passport is in the drawer' },
    { requestId: 2, messageId: 20, text: 'need help booking a flight' },
  ]

  it('matches case-insensitively on substring', () => {
    expect(searchIndex(entries, 'PASSPORT')).toEqual([entries[0]])
  })

  it('returns nothing for an empty/whitespace query', () => {
    expect(searchIndex(entries, '  ')).toEqual([])
  })

  it('returns an empty array when nothing matches', () => {
    expect(searchIndex(entries, 'zzz')).toEqual([])
  })
})
