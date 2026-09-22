// Escrow upload/recovery: wires crypto.js wrap/unwrap to keyStore and server endpoints.
// Shared by signup flow and recovery page.

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
// Best-effort: crypto is a standalone feature, not on critical path.
//
// ponytail: escrow and non-escrow paths share generate→save→export→upload skeleton.
// Not extracted (divergence in savePrivateKey timing), revisit if third path emerges.
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

// Escrow backup at signup: generate, wrap, upload backup and public key.
// Best-effort: crypto is standalone, not critical path.
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
