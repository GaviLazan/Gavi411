// E2E messaging crypto core: standalone subsystem using Web Crypto API only.
// ponytail: native platform feature covers this, no dependencies.
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

// Chunked to avoid "Maximum call stack size exceeded" on large image payloads.
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

// Device linking: wrap conversation AES-GCM keys for new devices.
// Uses ECDH-derived shared secret (admin.privateKey + device.publicKey) as wrapping key.

// Wraps a conversation's AES-GCM key for one specific device: encrypts its
// raw bytes under ECDH(admin.privateKey, device.publicKey). Returns
// { iv, ciphertext } (base64) — same envelope shape as a message, so no
// new wire format to learn.
//
// Takes `friendPublicKey` (not the conversation CryptoKey itself) because
// the real conversation key from deriveSharedKey() is deliberately
// non-extractable (see that function's own doc comment) — its raw bytes
// can never be read out, by design, so there's nothing to wrap. ECDH is
// deterministic given the same two keys, so re-deriving with
// extractable: true here reproduces the exact same shared secret, this
// time as a value only ever used transiently to export+wrap it — never
// stored, never used to encrypt/decrypt a message directly.
export async function wrapConversationKey(adminPrivateKey, friendPublicKey, devicePublicKey) {
  const extractableConversationKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: friendPublicKey },
    adminPrivateKey,
    AES_PARAMS,
    true,
    ['encrypt', 'decrypt'],
  )
  const wrappingKey = await deriveSharedKey(adminPrivateKey, devicePublicKey)
  const raw = await crypto.subtle.exportKey('raw', extractableConversationKey)
  return encrypt(wrappingKey, new Uint8Array(raw))
}

// Reverses wrapConversationKey from the new device's side: derives the
// same shared secret (ECDH is symmetric — device.privateKey +
// admin.publicKey lands on the identical wrappingKey admin used), decrypts
// the wrapped bytes, re-imports as a usable AES-GCM CryptoKey.
export async function unwrapConversationKey(wrapped, devicePrivateKey, adminPublicKey) {
  const wrappingKey = await deriveSharedKey(devicePrivateKey, adminPublicKey)
  const raw = await decrypt(wrappingKey, wrapped)
  return crypto.subtle.importKey('raw', raw, AES_PARAMS, false, ['encrypt', 'decrypt'])
}

// Escrow: backup device private key via PBKDF2-derived AES-GCM wrapping (passphrase + salt).
// Server sees ciphertext only. Recovery re-imports as non-extractable.
// ponytail: deterministic regen from passphrase rejected (no seeded ECDH keygen in Web Crypto).

const PBKDF2_ITERATIONS = 210_000 // OWASP 2023 minimum for PBKDF2-HMAC-SHA256

// Generates the extractable keypair escrowPrivateKey() wraps and uploads.
// Deliberately separate from generateKeypair() above — that one is
// non-extractable by design and stays that way; this is the one place an
// extractable ECDH private key is allowed to exist, and only transiently
// (exported once, wrapped, then the caller should keep only the
// non-extractable form — see recoverPrivateKey).
export async function generateExtractableKeypair() {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

// Derives an AES-GCM key from the escrow passphrase + a random salt.
async function deriveEscrowKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AES_PARAMS,
    false,
    ['encrypt', 'decrypt'],
  )
}

// Generates a fresh extractable ECDH keypair for escrow purposes and
// returns its private key wrapped under the passphrase, ready to upload.
// Returns { publicKey (base64, raw), backup: { salt, iv, ciphertext } (all
// base64) }. The caller is responsible for actually using/storing
// publicKey/privateKey as the device's real identity — this function only
// produces the recoverable backup.
export async function escrowPrivateKey(passphrase, keypair) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const escrowKey = await deriveEscrowKey(passphrase, salt)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keypair.privateKey)
  const { iv, ciphertext } = await encrypt(escrowKey, new Uint8Array(pkcs8))
  return { salt: bufToBase64(salt), iv, ciphertext }
}

// Reverses escrowPrivateKey: given the passphrase and the stored backup,
// decrypts and re-imports the private key. Imported as non-extractable —
// once recovered, the key gets the same protection as any other device key
// (see generateKeypair's doc comment), it doesn't stay exportable.
export async function recoverPrivateKey(passphrase, backup) {
  const salt = base64ToBuf(backup.salt)
  const escrowKey = await deriveEscrowKey(passphrase, new Uint8Array(salt))
  const pkcs8 = await decrypt(escrowKey, backup)
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH_PARAMS, false, ['deriveKey', 'deriveBits'])
}
