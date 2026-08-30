// G411-28 stage 1 — crypto core round-trip check (the Falsifier from the
// Jira Aegis fields). Runs against real Web Crypto (Node's global
// crypto.subtle), no mocks — keyStore.js (IndexedDB, browser-only) is
// deliberately not exercised here, same DOM-avoidance convention as
// useTheme.test.js.
import { describe, it, expect } from 'vitest'
import {
  generateKeypair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt,
  decryptText,
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
