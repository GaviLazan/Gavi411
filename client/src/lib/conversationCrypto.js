// Wires crypto.js's primitives + keyStore.js's IndexedDB key into the
// real message send/receive path (G411-82). Kept separate from crypto.js
// itself (pure primitives, no fetch/IndexedDB) and from escrow.js
// (signup-time backup orchestration) — this is the per-message runtime
// glue RequestDetail.jsx/MessageThread.jsx actually call.

import { deriveSharedKey, encrypt, decryptText, importPublicKey } from './crypto.js'
import { loadPrivateKey } from './keyStore.js'

// Fetches both parties' public keys for a request from the server (see
// server/routes/requests.js GET /:id/public-keys) and derives the shared
// AES-GCM key for this conversation. Returns null if either party has no
// public key yet (see the route's own doc comment for why that's a real,
// expected case, not just an error).
export async function getConversationKey(requestId) {
  const privateKey = await loadPrivateKey()
  if (!privateKey) return null

  const res = await fetch(`/api/requests/${requestId}/public-keys`)
  if (!res.ok) return null
  const { other } = await res.json()
  if (!other) return null

  const otherPublicKey = await importPublicKey(other)
  return deriveSharedKey(privateKey, otherPublicKey)
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
