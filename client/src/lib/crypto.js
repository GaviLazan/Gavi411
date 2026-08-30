// E2E messaging crypto core (G411-28 stage 1). Standalone subsystem per
// decision #28 (gavi411-brain.md) — not wired into the message send/
// receive flow yet, that's separate follow-on scope. Web Crypto API only,
// no dependencies (ponytail: native platform feature covers this).
//
// Flow this supports: each user generates an ECDH keypair on first use.
// Private key is non-extractable and stays in IndexedDB (browser-only,
// see keyStore.js); the public key is exported (raw bytes, base64) for
// the server. Two parties' keys derive a shared secret via ECDH; that
// secret becomes an AES-GCM key used to encrypt/decrypt message text and
// image bytes before they ever leave the browser.

const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' }
const AES_PARAMS = { name: 'AES-GCM', length: 256 }
// 12 bytes is the recommended/standard IV length for AES-GCM.
const IV_BYTES = 12

// Generates a fresh ECDH keypair. The private key is non-extractable
// (`extractable: false`) — it can be used for deriveKey/deriveBits but
// its raw bytes can never leave the CryptoKey object, so even code with
// access to the IndexedDB entry can't exfiltrate it, only use it.
export async function generateKeypair() {
  return crypto.subtle.generateKey(ECDH_PARAMS, false, ['deriveKey', 'deriveBits'])
}

// Exports a public key to a base64 string for transmission to the server.
export async function exportPublicKey(publicKey) {
  const raw = await crypto.subtle.exportKey('raw', publicKey)
  return bufToBase64(raw)
}

// Imports a base64-encoded public key (e.g. fetched from the server for
// the other party in a conversation) back into a usable CryptoKey.
export async function importPublicKey(base64) {
  const raw = base64ToBuf(base64)
  return crypto.subtle.importKey('raw', raw, ECDH_PARAMS, true, [])
}

// Derives the shared AES-GCM key for a conversation from one party's
// private key and the other party's public key. ECDH guarantees both
// directions (A's private + B's public) and (B's private + A's public)
// land on the same shared secret.
export async function deriveSharedKey(privateKey, otherPublicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: otherPublicKey },
    privateKey,
    AES_PARAMS,
    false,
    ['encrypt', 'decrypt'],
  )
}

// Encrypts text or binary data with the shared key. Returns
// { iv, ciphertext } as base64 strings — a fresh random IV every call
// (required for AES-GCM: reusing an IV with the same key breaks the
// encryption's security guarantees).
export async function encrypt(sharedKey, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plainBuf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, plainBuf)
  return { iv: bufToBase64(iv), ciphertext: bufToBase64(ciphertext) }
}

// Decrypts { iv, ciphertext } (base64) with the shared key. Returns raw
// bytes (ArrayBuffer) — call decryptText() instead for a text payload.
export async function decrypt(sharedKey, { iv, ciphertext }) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuf(iv) },
    sharedKey,
    base64ToBuf(ciphertext),
  )
}

export async function decryptText(sharedKey, envelope) {
  const buf = await decrypt(sharedKey, envelope)
  return new TextDecoder().decode(buf)
}

// Chunked to avoid spreading the whole buffer as call arguments — a
// single String.fromCharCode(...bytes) call throws "Maximum call stack
// size exceeded" past ~128KB, which real image payloads (this module's
// whole point) routinely exceed (Sibling review finding).
const CHUNK_SIZE = 8192

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

function base64ToBuf(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer
}
