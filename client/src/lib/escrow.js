// Escrow upload/recovery orchestration (G411-28 stage 4). Thin glue
// between crypto.js's wrap/unwrap primitives, keyStore.js's IndexedDB
// storage, and the server's /api/invites/:token/backup endpoints — kept
// separate from App.jsx so both the signup flow and the recovery page can
// call the same two functions.

import { generateExtractableKeypair, escrowPrivateKey, recoverPrivateKey } from './crypto.js'
import { savePrivateKey } from './keyStore.js'

// Called once at signup, when a stashed invite token + escrow passphrase
// are both available (see inviteToken.js). Generates the escrow keypair,
// saves its private key as this device's key (same shape/role as a
// generateKeypair() result — see keyStore.js), and uploads the wrapped
// backup. Best-effort: a failure here shouldn't block signup, since the
// crypto subsystem is a standalone feature (decision #28) that isn't on
// the critical path for using the app — logs and returns false instead
// of throwing.
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
    return res.ok
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
