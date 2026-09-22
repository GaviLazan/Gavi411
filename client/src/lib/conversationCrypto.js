// Message encryption/decryption wired to keyStore and crypto primitives.
// Separate from crypto.js (pure primitives) and escrow.js (signup-time backup).

import { deriveSharedKey, encrypt, decryptText, importPublicKey } from './crypto.js'
import { loadPrivateKey, loadDeviceId } from './keyStore.js'

// Sentinel distinguishing "other party has no key yet" from "this device needs setup".
// Exported so callers can match without duplicating it.
export const OTHER_PARTY_MISSING_KEY = Symbol('other-party-missing-key')

// Cache conversation keys: requestId → Promise<CryptoKey|null>.
// Persists for page load; caches in-flight Promises to collapse concurrent derivations.
// ponytail: simplest cache fixing redundancy, upgrade to explicit invalidation if key rotation needed.
const conversationKeyCache = new Map()

// Test-only escape hatch — the module-level cache above persists across
// test cases that reuse the same requestId, which would otherwise make
// later tests silently see an earlier test's cached (possibly null)
// result instead of exercising a fresh fetch.
export function _clearConversationKeyCacheForTests() {
  conversationKeyCache.clear()
}

// Device-linking: pre-derived keys for approved linked devices (no direct ECDH with other party).
// Seeded by App.jsx's post-approval check; getConversationKey checks this first before ECDH derivation.
const linkedConversationKeys = new Map()

export function seedLinkedConversationKeys(keysByRequestId) {
  for (const [requestId, key] of keysByRequestId) {
    linkedConversationKeys.set(requestId, key)
  }
}

// Fetches both parties' public keys for a request from the server (see
// server/routes/requests.js GET /:id/public-keys) and derives the shared
// AES-GCM key for this conversation. Returns null if either party has no
// public key yet (see the route's own doc comment for why that's a real,
// expected case, not just an error).
export async function getConversationKey(requestId) {
  if (linkedConversationKeys.has(requestId)) {
    return linkedConversationKeys.get(requestId)
  }
  if (conversationKeyCache.has(requestId)) {
    return conversationKeyCache.get(requestId)
  }

  const promise = (async () => {
    const privateKey = await loadPrivateKey()
    if (!privateKey) return null

    // Linked device: no direct ECDH with other party. If key not in
    // linkedConversationKeys, return null (not a derived key, which would be wrong).
    // This triggers the missing-wraps sweep in RequestDetail.jsx.
    const deviceId = await loadDeviceId()
    if (deviceId != null) return null

    const res = await fetch(`/api/requests/${requestId}/public-keys`)
    if (!res.ok) return null
    const { other } = await res.json()
    if (!other) return OTHER_PARTY_MISSING_KEY

    const otherPublicKey = await importPublicKey(other)
    return deriveSharedKey(privateKey, otherPublicKey)
  })()

  conversationKeyCache.set(requestId, promise)
  // Evict null/sentinel/rejection from cache: all mean "couldn't derive now", which can change.
  // Prevents stale null blocking recovery button.
  promise.then(
    (key) => {
      if (key === null || key === OTHER_PARTY_MISSING_KEY) conversationKeyCache.delete(requestId)
    },
    () => conversationKeyCache.delete(requestId)
  )
  return promise
}

// Encrypts message text into the { iv, ciphertext } envelope, JSON-
// stringified so it fits the existing Message.content String column
// (Message.encrypted: true marks it as such — see prisma/schema.prisma).
export async function encryptMessageContent(sharedKey, text) {
  const envelope = await encrypt(sharedKey, text)
  return JSON.stringify(envelope)
}

// Decrypt message: plaintext rows (encrypted: false) pass through unchanged.
export async function decryptMessageContent(sharedKey, message) {
  if (!message.encrypted) return message.content
  // Sentinel and null both render placeholder (no usable key).
  if (!sharedKey || sharedKey === OTHER_PARTY_MISSING_KEY) return null
  const envelope = JSON.parse(message.content)
  return decryptText(sharedKey, envelope)
}
