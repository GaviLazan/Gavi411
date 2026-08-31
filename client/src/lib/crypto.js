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

// --- Escrow (G411-28 stage 4) ---------------------------------------------
//
// The device's own long-term private key is deliberately non-extractable
// (generateKeypair above) — that's correct for day-to-day use, but it means
// there's nothing to back up if the device is lost. Escrow solves this with
// a SEPARATE, extractable ECDH keypair generated once at signup, whose
// private key is immediately wrapped (PBKDF2-derived AES-GCM key, from a
// one-time passphrase the server generates and hands to Gavi out-of-band —
// see server/routes/invites.js) and uploaded as ciphertext only. The
// server never sees the passphrase or the unwrapped key. Recovery imports
// the unwrapped key back in as non-extractable (see recoverPrivateKey) —
// same security posture as a freshly generated device key, so escrow never
// leaves a long-lived extractable key sitting around.
//
// ponytail: regenerating identity deterministically from the passphrase
// (no export/wrap step at all) was considered and would be less code, but
// Web Crypto has no seeded ECDH keygen — doing that correctly means
// hand-rolling EC scalar derivation, which is real crypto-library work,
// not simpler. Wrap-and-upload is the actually-simpler-and-correct option.

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
