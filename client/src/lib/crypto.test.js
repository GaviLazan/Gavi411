// G411-28 stage 1 — crypto core round-trip check (the Falsifier from the
// Jira Aegis fields). Runs against real Web Crypto (Node's global
// crypto.subtle), no mocks — keyStore.js (IndexedDB, browser-only) is
// deliberately not exercised here, same DOM-avoidance convention as
// useTheme.test.js.
import { describe, it, expect } from 'vitest'
import {
  generateKeypair,
  generateExtractableKeypair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt,
  decryptText,
  escrowPrivateKey,
  recoverPrivateKey,
} from './crypto.js'

describe('crypto core (keypair, ECDH, AES-GCM)', () => {
  it('two independently generated keypairs derive the same shared secret both directions', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()

    const aliceExported = await importPublicKey(await exportPublicKey(alice.publicKey))
    const bobExported = await importPublicKey(await exportPublicKey(bob.publicKey))

    const aliceShared = await deriveSharedKey(alice.privateKey, bobExported)
    const bobShared = await deriveSharedKey(bob.privateKey, aliceExported)

    // Can't compare CryptoKey objects directly — prove equivalence by
    // encrypting with one side's derived key and decrypting with the other's.
    const envelope = await encrypt(aliceShared, 'shared secret check')
    expect(await decryptText(bobShared, envelope)).toBe('shared secret check')
  })

  it('round-trips a text message', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const shared = await deriveSharedKey(alice.privateKey, bob.publicKey)

    const envelope = await encrypt(shared, 'hello שלום mixed bidi text')
    expect(envelope.iv).toBeTypeOf('string')
    expect(envelope.ciphertext).toBeTypeOf('string')
    expect(await decryptText(shared, envelope)).toBe('hello שלום mixed bidi text')
  })

  it('round-trips binary (image) data', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const shared = await deriveSharedKey(alice.privateKey, bob.publicKey)

    const original = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128])
    const envelope = await encrypt(shared, original)
    const decrypted = new Uint8Array(await decrypt(shared, envelope))
    expect(decrypted).toEqual(original)
  })

  it('ciphertext is not readable without the derived key (wrong key fails)', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const mallory = await generateKeypair()

    const sharedAB = await deriveSharedKey(alice.privateKey, bob.publicKey)
    const wrongShared = await deriveSharedKey(mallory.privateKey, bob.publicKey)

    const envelope = await encrypt(sharedAB, 'secret')
    await expect(decrypt(wrongShared, envelope)).rejects.toThrow()
  })

  it('round-trips a large binary payload (real image size, Sibling review regression)', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const shared = await deriveSharedKey(alice.privateKey, bob.publicKey)

    // ~200KB — past the ~128KB spread-call-argument limit that broke
    // bufToBase64 before the fix; a real phone photo is this size or
    // larger. getRandomValues itself caps at 65536 bytes/call, so fill
    // in chunks just to build the test fixture.
    const original = new Uint8Array(200_000)
    for (let i = 0; i < original.length; i += 65_536) {
      crypto.getRandomValues(original.subarray(i, i + 65_536))
    }
    const envelope = await encrypt(shared, original)
    const decrypted = new Uint8Array(await decrypt(shared, envelope))
    expect(decrypted).toEqual(original)
  })

  it('ciphertext differs from plaintext and from itself on repeat calls (random IV)', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const shared = await deriveSharedKey(alice.privateKey, bob.publicKey)

    const e1 = await encrypt(shared, 'repeat me')
    const e2 = await encrypt(shared, 'repeat me')
    expect(e1.ciphertext).not.toBe('repeat me')
    expect(e1.iv).not.toBe(e2.iv)
    expect(e1.ciphertext).not.toBe(e2.ciphertext)
  })
})

describe('escrow (wrap/unwrap a private key with a passphrase)', () => {
  it('recovers a key that can derive the same shared secret as the original', async () => {
    const escrowKeypair = await generateExtractableKeypair()
    const bob = await generateKeypair()

    const backup = await escrowPrivateKey('correct horse battery staple', escrowKeypair)
    const recovered = await recoverPrivateKey('correct horse battery staple', backup)

    const originalShared = await deriveSharedKey(escrowKeypair.privateKey, bob.publicKey)
    const recoveredShared = await deriveSharedKey(recovered, bob.publicKey)

    const envelope = await encrypt(originalShared, 'escrow round trip')
    expect(await decryptText(recoveredShared, envelope)).toBe('escrow round trip')
  })

  it('recovered key is non-extractable, unlike the original escrow keypair', async () => {
    const escrowKeypair = await generateExtractableKeypair()
    expect(escrowKeypair.privateKey.extractable).toBe(true)

    const backup = await escrowPrivateKey('a passphrase', escrowKeypair)
    const recovered = await recoverPrivateKey('a passphrase', backup)
    expect(recovered.extractable).toBe(false)
  })

  it('wrong passphrase fails to recover', async () => {
    const escrowKeypair = await generateExtractableKeypair()
    const backup = await escrowPrivateKey('right passphrase', escrowKeypair)
    await expect(recoverPrivateKey('wrong passphrase', backup)).rejects.toThrow()
  })

  it('backup fields are all base64 strings, safe to store/transmit as JSON', async () => {
    const escrowKeypair = await generateExtractableKeypair()
    const backup = await escrowPrivateKey('a passphrase', escrowKeypair)
    expect(backup.salt).toBeTypeOf('string')
    expect(backup.iv).toBeTypeOf('string')
    expect(backup.ciphertext).toBeTypeOf('string')
  })
})
