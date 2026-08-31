// G411-82 — conversation-crypto glue (real message send/receive path).
// Real Web Crypto (Node's global crypto.subtle), mocked fetch + keyStore
// (same convention as escrow.js's own doc comment — keyStore.js is
// IndexedDB/browser-only, kept untested by design; crypto.js's primitives
// already have their own real round-trip coverage in crypto.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeypair, exportPublicKey, deriveSharedKey, encrypt } from './crypto.js'

const mockLoadPrivateKey = vi.fn()
vi.mock('./keyStore.js', () => ({ loadPrivateKey: (...args) => mockLoadPrivateKey(...args) }))

const { getConversationKey, encryptMessageContent, decryptMessageContent } = await import(
  './conversationCrypto.js'
)

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('getConversationKey', () => {
  it('returns null when this device has no private key yet', async () => {
    mockLoadPrivateKey.mockResolvedValue(null)
    const key = await getConversationKey(1)
    expect(key).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when the /public-keys fetch fails', async () => {
    const me = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    fetch.mockResolvedValue({ ok: false })

    expect(await getConversationKey(1)).toBeNull()
  })

  it('returns null when the other party has no public key yet', async () => {
    const me = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: null }) })

    expect(await getConversationKey(1)).toBeNull()
  })

  it('derives a real shared key from the fetched public key', async () => {
    const me = await generateKeypair()
    const other = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    const otherPublicB64 = await exportPublicKey(other.publicKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: otherPublicB64 }) })

    const sharedKey = await getConversationKey(1)
    expect(fetch).toHaveBeenCalledWith('/api/requests/1/public-keys')

    // Prove it's the real shared secret: the other party deriving with
    // their own private key + my public key should land on the same key.
    const otherShared = await deriveSharedKey(other.privateKey, me.publicKey)
    const envelope = await encrypt(sharedKey, 'round trip check')
    expect(await decryptMessageContent(otherShared, { encrypted: true, content: JSON.stringify(envelope) })).toBe(
      'round trip check'
    )
  })
})

describe('encryptMessageContent / decryptMessageContent', () => {
  it('round-trips text through the JSON-envelope-in-content shape', async () => {
    const a = await generateKeypair()
    const b = await generateKeypair()
    const shared = await deriveSharedKey(a.privateKey, b.publicKey)

    const content = await encryptMessageContent(shared, 'hello שלום')
    expect(() => JSON.parse(content)).not.toThrow()

    const decrypted = await decryptMessageContent(shared, { encrypted: true, content })
    expect(decrypted).toBe('hello שלום')
  })

  it('passes a plaintext (encrypted: false) message through unchanged, no decrypt attempted', async () => {
    const result = await decryptMessageContent(null, { encrypted: false, content: 'old plain message' })
    expect(result).toBe('old plain message')
  })

  it('returns null (not a throw) for an encrypted message with no shared key available', async () => {
    const result = await decryptMessageContent(null, { encrypted: true, content: '{"iv":"x","ciphertext":"y"}' })
    expect(result).toBeNull()
  })
})
