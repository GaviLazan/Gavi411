// Wires crypto.js's primitives + keyStore.js's IndexedDB key into the
// real message send/receive path (G411-82). Kept separate from crypto.js
// itself (pure primitives, no fetch/IndexedDB) and from escrow.js
// (signup-time backup orchestration) — this is the per-message runtime
// glue RequestDetail.jsx/MessageThread.jsx actually call.

import { deriveSharedKey, encrypt, decryptText, importPublicKey } from './crypto.js'
import { loadPrivateKey, loadDeviceId } from './keyStore.js'

// Sentinel `getConversationKey` can return instead of `null`, for the one
// case that isn't "this device needs a fix": the OTHER party simply has no
// public key yet. Matan's Sibling review (PR #35, Fix 2) — the two null
// causes used to be indistinguishable to callers, so RequestDetail.jsx
// offered the same destructive "request access" button (overwrites this
// device's local key) for both, even though it only helps cause (i).
// Exported so callers can `=== OTHER_PARTY_MISSING_KEY` without
// duplicating the sentinel value.
export const OTHER_PARTY_MISSING_KEY = Symbol('other-party-missing-key')

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

// G411-28 device-linking: once THIS device is approved, its wrapped
// conversation keys are unwrapped once (loadLinkedConversationKeys) and
// seeded in here — getConversationKey below checks this before falling
// back to its own normal ECDH derivation, since a linked device has no
// direct ECDH relationship of its own with the other party (it never
// exchanged public keys with them; it only received the conversation key
// admin already derived, pre-wrapped). Populated lazily, once, by
// App.jsx's post-approval check — see deviceLinking.js's own doc comment.
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

    // Matan's Sibling review, PR #35, Fix 1b: a LINKED device (one that
    // went through deviceLinking.js's requestDeviceLink, not the
    // account's original signup device) has no direct ECDH relationship
    // with the other party at all — it never exchanged public keys with
    // them, it only ever received admin's already-derived conversation
    // key, pre-wrapped, per request. If this requestId isn't in
    // linkedConversationKeys (checked above, before this promise even
    // starts), that means either the request didn't exist yet when this
    // device was approved, or a wrap is still pending. Falling through to
    // deriveSharedKey below would silently produce a REAL but WRONG
    // shared key (this device's own keypair was never meant to talk to
    // this other party), and messages would render an opaque "unable to
    // decrypt" forever with no indication why. Returning null here instead
    // makes the existing needsKeypair/recovery-banner path in
    // RequestDetail.jsx fire — the missing-wraps sweep (devices.js,
    // App.jsx/RequestDetail.jsx) is what actually resolves it.
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
  // Neither a rejected promise NOR a resolved null/sentinel should poison
  // the cache forever — all three mean "couldn't derive a key right now,"
  // which can genuinely change on the next call (e.g. the user just used
  // the self-service "Generate my encryption key" recovery button, the
  // other party just uploaded theirs, or the missing-wraps sweep just
  // filled in a linked device's key). Real bug caught by Sibling review
  // (second round): only rejections were evicted here originally, so a
  // cached null from before the recovery button was clicked kept being
  // returned after the fix succeeded, silently defeating that whole
  // recovery flow until a full page reload.
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

// Decrypts one Message row's content for display. Plaintext rows
// (encrypted: false) pass through unchanged — no decrypt attempt, per
// Gavi's call that old messages stay plaintext, not migrated.
export async function decryptMessageContent(sharedKey, message) {
  if (!message.encrypted) return message.content
  // OTHER_PARTY_MISSING_KEY is a real (truthy) Symbol, not a usable key —
  // caller renders a placeholder either way, same as the no-key case.
  if (!sharedKey || sharedKey === OTHER_PARTY_MISSING_KEY) return null
  const envelope = JSON.parse(message.content)
  return decryptText(sharedKey, envelope)
}
