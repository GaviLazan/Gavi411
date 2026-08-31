// Escrow upload/recovery orchestration (G411-28 stage 4; keypair
// generation folded in G411-82). Thin glue between crypto.js's wrap/
// unwrap primitives, keyStore.js's IndexedDB storage, and the server's
// /api/invites/:token/backup + /api/me/public-key endpoints — kept
// separate from App.jsx so both the signup flow and the recovery page can
// call the same functions.
//
// G411-82: this used to be the ONLY code path that generated+saved a
// device keypair, and only fired when a passphrase was present — a
// signup with no passphrase (stale/stripped link) left that user with
// zero keypair, ever. uploadPublicKey() below is now called from BOTH
// branches of App.jsx's signup handoff; escrow wraps the extractable
// keypair it generates for backup purposes, the plain path generates a
// normal non-extractable one via crypto.js's generateKeypair() — either
// way, every signup ends up with a real keypair and an uploaded public key.

import { generateKeypair, generateExtractableKeypair, escrowPrivateKey, exportPublicKey, recoverPrivateKey } from './crypto.js'
import { savePrivateKey } from './keyStore.js'

// Uploads this device's public key to /api/me/public-key. Shared by both
// signup branches below (and by InviteAdmin.jsx's one-off admin
// bootstrap — see its own doc comment). Not wrapped in try/catch here —
// callers decide whether a failure is fatal (signup) or should surface
// to the user directly (admin bootstrap button).
export async function uploadPublicKey(publicKey) {
  const res = await fetch('/api/me/public-key', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  })
  return res.ok
}

// Called once at signup for every user who did NOT arrive with an escrow
// passphrase (stale/no-passphrase invite link). Generates a normal
// (non-extractable) device keypair, saves it, uploads the public key.
// Best-effort, same reasoning as the escrow path below — messaging
// crypto is a standalone feature (decision #28), not on the critical
// path for using the app at all.
export async function createAndUploadKeypair() {
  try {
    const keypair = await generateKeypair()
    await savePrivateKey(keypair.privateKey)
    const publicKey = await exportPublicKey(keypair.publicKey)
    return await uploadPublicKey(publicKey)
  } catch (err) {
    console.error('Keypair generation/upload failed:', err)
    return false
  }
}

// Called once at signup, when a stashed invite token + escrow passphrase
// are both available (see inviteToken.js). Generates the escrow keypair,
// saves its private key as this device's key (same shape/role as a
// generateKeypair() result — see keyStore.js), uploads the wrapped
// backup, and uploads the public key (G411-82 — previously only the
// backup was uploaded, so the server had no public key to hand other
// parties for ECDH even though this path did generate a real keypair).
// Best-effort: a failure here shouldn't block signup, since the crypto
// subsystem is a standalone feature (decision #28) that isn't on the
// critical path for using the app — logs and returns false instead of
// throwing.
export async function createAndUploadEscrowBackup(token, passphrase) {
  try {
    const keypair = await generateExtractableKeypair()
    const backup = await escrowPrivateKey(passphrase, keypair)
    await savePrivateKey(keypair.privateKey)

    const res = await fetch(`/api/invites/${encodeURIComponent(token)}/backup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    })
    if (!res.ok) return false

    const publicKey = await exportPublicKey(keypair.publicKey)
    return await uploadPublicKey(publicKey)
  } catch (err) {
    console.error('Escrow backup upload failed:', err)
    return false
  }
}

// Called from the recovery page. Fetches the stored backup for `token`
// and unwraps it with `passphrase`, then saves the recovered key as this
// device's key. Throws on failure (wrong passphrase, no backup found,
// etc.) — the recovery page is expected to show that as a real error, not
// silently no-op.
export async function recoverAndSaveBackup(token, passphrase) {
  const res = await fetch(`/api/invites/${encodeURIComponent(token)}/backup`)
  if (!res.ok) throw new Error('No backup found for this recovery link')
  const backup = await res.json()

  const privateKey = await recoverPrivateKey(passphrase, backup)
  await savePrivateKey(privateKey)
}
