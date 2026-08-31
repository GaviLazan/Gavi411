// Wires crypto.js's primitives + keyStore.js's IndexedDB key into the
// real message send/receive path (G411-82). Kept separate from crypto.js
// itself (pure primitives, no fetch/IndexedDB) and from escrow.js
// (signup-time backup orchestration) — this is the per-message runtime
// glue RequestDetail.jsx/MessageThread.jsx actually call.

import { deriveSharedKey, encrypt, decryptText, importPublicKey } from './crypto.js'
import { loadPrivateKey } from './keyStore.js'

// requestId -> Promise<CryptoKey|null>, cached for the life of this page
// load (Sibling review finding — RequestDetail.jsx's decrypt effect
// re-fires on every refetch since `request.message` is a fresh array
// reference each time, and sendMessage() derives the key independently
// too; without this cache, one send could redo the IndexedDB load +
// /public-keys fetch + ECDH derive 2-3 times for a key that never
// changed). Caching the in-flight Promise (not just the resolved key)
// also collapses concurrent calls for the same requestId into one
// derivation instead of racing separate ones. No cross-page persistence
// or invalidation beyond a full reload — if either party's public key
// ever changes mid-session, a reload picks that up, which is an
// acceptable tradeoff for how rarely that happens (ponytail: simplest
// cache that actually fixes the redundancy, upgrade to explicit
// invalidation if key rotation becomes a real feature).
const conversationKeyCache = new Map()

// Test-only escape hatch — the module-level cache above persists across
// test cases that reuse the same requestId, which would otherwise make
// later tests silently see an earlier test's cached (possibly null)
// result instead of exercising a fresh fetch.
export function _clearConversationKeyCacheForTests() {
  conversationKeyCache.clear()
}

// Fetches both parties' public keys for a request from the server (see
// server/routes/requests.js GET /:id/public-keys) and derives the shared
// AES-GCM key for this conversation. Returns null if either party has no
// public key yet (see the route's own doc comment for why that's a real,
// expected case, not just an error).
export async function getConversationKey(requestId) {
  if (conversationKeyCache.has(requestId)) {
    return conversationKeyCache.get(requestId)
  }

  const promise = (async () => {
    const privateKey = await loadPrivateKey()
    if (!privateKey) return null

    const res = await fetch(`/api/requests/${requestId}/public-keys`)
    if (!res.ok) return null
    const { other } = await res.json()
    if (!other) return null

    const otherPublicKey = await importPublicKey(other)
    return deriveSharedKey(privateKey, otherPublicKey)
  })()

  conversationKeyCache.set(requestId, promise)
  // Neither a rejected promise NOR a resolved null should poison the
  // cache forever — both mean "couldn't derive a key right now," which
  // can genuinely change on the next call (e.g. the user just used the
  // self-service "Generate my encryption key" recovery button, or the
  // other party just uploaded theirs). Real bug caught by Sibling review
  // (second round): only rejections were evicted here originally, so a
  // cached null from before the recovery button was clicked kept being
  // returned after the fix succeeded, silently defeating that whole
  // recovery flow until a full page reload.
  promise.then(
    (key) => {
      if (key === null) conversationKeyCache.delete(requestId)
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

// Decrypts one Message row's content for display. Plaintext rows
// (encrypted: false) pass through unchanged — no decrypt attempt, per
// Gavi's call that old messages stay plaintext, not migrated.
export async function decryptMessageContent(sharedKey, message) {
  if (!message.encrypted) return message.content
  if (!sharedKey) return null // caller renders a placeholder, doesn't crash
  const envelope = JSON.parse(message.content)
  return decryptText(sharedKey, envelope)
}
