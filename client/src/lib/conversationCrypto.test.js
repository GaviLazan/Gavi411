// G411-82 — conversation-crypto glue (real message send/receive path).
// Real Web Crypto (Node's global crypto.subtle), mocked fetch + keyStore
// (same convention as escrow.js's own doc comment — keyStore.js is
// IndexedDB/browser-only, kept untested by design; crypto.js's primitives
// already have their own real round-trip coverage in crypto.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeypair, exportPublicKey, deriveSharedKey, encrypt } from './crypto.js'

const mockLoadPrivateKey = vi.fn()
const mockLoadDeviceId = vi.fn()
vi.mock('./keyStore.js', () => ({
  loadPrivateKey: (...args) => mockLoadPrivateKey(...args),
  loadDeviceId: (...args) => mockLoadDeviceId(...args),
}))

const {
  getConversationKey,
  encryptMessageContent,
  decryptMessageContent,
  _clearConversationKeyCacheForTests,
  OTHER_PARTY_MISSING_KEY,
} = await import('./conversationCrypto.js')

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  // Every existing test below exercises a non-linked device (the normal
  // ECDH path) — loadDeviceId() defaults to null so those tests don't all
  // need to opt in individually. The linked-device tests set this to a
  // real id explicitly.
  mockLoadDeviceId.mockResolvedValue(null)
  // getConversationKey caches per-requestId (see its own doc comment) —
  // several tests below call it with the same requestId (1), so the
  // cache has to be cleared between tests or a later test would silently
  // reuse an earlier test's cached result instead of exercising a fresh
  // fetch.
  _clearConversationKeyCacheForTests()
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

  // Matan's Sibling review, PR #35, Fix 2 — this used to return null,
  // indistinguishable from "this device has no key." Now returns a
  // dedicated sentinel so RequestDetail.jsx can tell the two apart and
  // not offer a destructive fix for a problem that isn't on this device.
  it('returns OTHER_PARTY_MISSING_KEY (not null) when the other party has no public key yet', async () => {
    const me = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: null }) })

    expect(await getConversationKey(1)).toBe(OTHER_PARTY_MISSING_KEY)
  })

  // Matan's Sibling review, PR #35, Fix 1b — a linked device (has a
  // deviceId but this requestId was never seeded into
  // linkedConversationKeys) must NOT fall through to normal ECDH
  // derivation using its own keypair: that keypair was never exchanged
  // with the other party at all, so it would silently produce a real but
  // wrong shared key. Returning null here instead makes the existing
  // needsKeypair banner fire so the missing-wraps sweep gets a chance to
  // actually fix it.
  it('returns null for a linked device with no seeded key for this request, without deriving one', async () => {
    const me = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    mockLoadDeviceId.mockResolvedValue(42)

    expect(await getConversationKey(1)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
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

  // Sibling review finding (second round) — a resolved null was cached
  // forever, only rejections were evicted. That silently broke the
  // self-service "Generate my encryption key" recovery flow: a user who
  // fixed their missing keypair kept getting the stale cached null on
  // their next send attempt for the same requestId, with no way out
  // short of a full page reload.
  it('retries instead of returning a stale cached sentinel once the key becomes available', async () => {
    const me = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: null }) })

    expect(await getConversationKey(1)).toBe(OTHER_PARTY_MISSING_KEY)

    // The device "fixes" its keypair situation — the other party now has
    // a public key on file (e.g. the self-service recovery button ran).
    const other = await generateKeypair()
    const otherPublicB64 = await exportPublicKey(other.publicKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: otherPublicB64 }) })

    const sharedKey = await getConversationKey(1)
    expect(sharedKey).not.toBeNull()
    // A real fetch happened again — proves the null wasn't served from a
    // stale cache entry.
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('caches a successfully-derived key so a second call does not re-fetch', async () => {
    const me = await generateKeypair()
    const other = await generateKeypair()
    mockLoadPrivateKey.mockResolvedValue(me.privateKey)
    const otherPublicB64 = await exportPublicKey(other.publicKey)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ me: null, other: otherPublicB64 }) })

    const first = await getConversationKey(1)
    const second = await getConversationKey(1)
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
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

  // OTHER_PARTY_MISSING_KEY is a truthy Symbol, not a usable key — without
  // this check it would fall through to JSON.parse/decryptText and throw
  // instead of rendering the same "can't decrypt yet" placeholder as the
  // null case.
  it('returns null (not a throw) when the sharedKey is the OTHER_PARTY_MISSING_KEY sentinel', async () => {
    const result = await decryptMessageContent(OTHER_PARTY_MISSING_KEY, {
      encrypted: true,
      content: '{"iv":"x","ciphertext":"y"}',
    })
    expect(result).toBeNull()
  })
})
