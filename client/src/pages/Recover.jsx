import { useState } from 'react'
import { recoverAndSaveBackup } from '../lib/escrow'

// Escrow recovery page (G411-28 stage 4). Reached via a single-use
// recovery link (?recover=<token>#<passphrase> — same URL-fragment
// convention as the invite link itself, see App.jsx and
// lib/inviteToken.js's doc comment for why the passphrase must never
// travel as a query param). Restores the escrowed private key into this
// device's keyStore.js so a friend who lost their original device can
// pick back up on a new one, given by Gavi out-of-band (the same
// passphrase from the original invite-creation CSV export).
function Recover({ token, passphrase, onDone }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'working' | 'done' | 'error'

  async function handleRecover() {
    setStatus('working')
    try {
      await recoverAndSaveBackup(token, passphrase)
      setStatus('done')
    } catch (err) {
      console.error('Recovery failed:', err)
      setStatus('error')
    }
  }

  if (!token || !passphrase) {
    return <p role="alert">This recovery link is missing its token or passphrase.</p>
  }

  return (
    <div className="recover-page">
      <h2>Recover your key</h2>
      {status === 'done' ? (
        <>
          <p>Done — your key has been restored on this device.</p>
          <button type="button" onClick={onDone}>Continue</button>
        </>
      ) : (
        <>
          <p>This will restore your encrypted message key on this device.</p>
          <button type="button" onClick={handleRecover} disabled={status === 'working'}>
            {status === 'working' ? 'Recovering…' : 'Recover key'}
          </button>
          {status === 'error' && (
            <p role="alert">Could not recover — the link may be invalid or already used.</p>
          )}
        </>
      )}
    </div>
  )
}

export default Recover
