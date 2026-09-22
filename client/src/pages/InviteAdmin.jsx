import { useEffect, useState } from 'react'
import { downloadInviteCsv } from '../lib/inviteCsv'
import { createAndUploadKeypair } from '../lib/escrow'
import { getPendingDevices, approveDevice, rejectDevice } from '../lib/deviceLinking'
import { loadPrivateKey } from '../lib/keyStore'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import './InviteAdmin.css'

// Minimal admin invite-creation screen
function InviteAdmin() {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)
  const [invites, setInvites] = useState([])

  // Admin-only: one-time keypair generation for original admin account
  const [hasPublicKey, setHasPublicKey] = useState(true)
  const [keypairStatus, setKeypairStatus] = useState('idle')
  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => setHasPublicKey(Boolean(data.user?.publicKey)))
      .catch(() => {})
  }, [])

  async function handleGenerateKeypair() {
    setKeypairStatus('working')
    const ok = await createAndUploadKeypair()
    setKeypairStatus(ok ? 'idle' : 'error')
    if (ok) setHasPublicKey(true)
  }

  function loadInvites() {
    fetch('/api/invites')
      .then((res) => res.json())
      .then(setInvites)
      .catch(() => {})
  }

  useEffect(loadInvites, [])

  // Device-linking: bare-minimum UI for approve/reject
  const [pendingDevices, setPendingDevices] = useState([])
  const [deviceActionError, setDeviceActionError] = useState(null)
  const [workingDeviceId, setWorkingDeviceId] = useState(null)

  function loadPendingDevices() {
    getPendingDevices().then(setPendingDevices).catch(() => {})
  }

  useEffect(loadPendingDevices, [])

  async function handleApproveDevice(device) {
    setWorkingDeviceId(device.id)
    setDeviceActionError(null)
    try {
      const adminPrivateKey = await loadPrivateKey()
      if (!adminPrivateKey) throw new Error('no local key')
      const requests = await fetch('/api/requests').then((res) => res.json())
      const requestIds = requests.filter((r) => r.userId === device.userId).map((r) => r.id)
      const { skippedRequestIds } = await approveDevice(device, adminPrivateKey, requestIds)
      if (skippedRequestIds.length > 0) {
        setDeviceActionError(
          `Approved, but ${skippedRequestIds.length} conversation(s) couldn't be shared yet (the friend has no encryption key on file) — request${skippedRequestIds.length > 1 ? 's' : ''} # ${skippedRequestIds.join(', ')}.`,
        )
      }
      loadPendingDevices()
    } catch {
      setDeviceActionError('Could not approve this device — try again.')
    } finally {
      setWorkingDeviceId(null)
    }
  }

  async function handleRejectDevice(device) {
    setWorkingDeviceId(device.id)
    setDeviceActionError(null)
    try {
      await rejectDevice(device.id)
      loadPendingDevices()
    } catch {
      setDeviceActionError('Could not reject this device — try again.')
    } finally {
      setWorkingDeviceId(null)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed to create invite')
      const invite = await res.json()
      setLastInvite(invite)
      setLabel('')
      loadInvites()
    } catch {
      setError('Could not create invite — try again.')
    } finally {
      setCreating(false)
    }
  }

  // Passphrase in URL fragment (#), not query string
  const lastLink = lastInvite
    ? `${window.location.origin}/?token=${lastInvite.token}#${lastInvite.passphrase}`
    : null

  return (
    <div className="invite-admin">
      <Card>
        <h2>Invites</h2>

        {!hasPublicKey && (
          <p role="alert" className="invite-admin-alert">
            This account has no messaging encryption key yet (expected for the original admin
            account, created before invites existed).{' '}
            <Button type="button" variant="secondary" onClick={handleGenerateKeypair} disabled={keypairStatus === 'working'}>
              {keypairStatus === 'working' ? 'Generating…' : 'Generate my encryption key'}
            </Button>
            {keypairStatus === 'error' && ' Failed — try again.'}
          </p>
        )}

        <form onSubmit={handleCreate} className="invite-admin-form">
          <Input
            id="invite-admin-label"
            type="text"
            placeholder="Note for yourself (optional, e.g. a name)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create invite link'}
          </Button>
        </form>
        {error && <p role="alert" className="invite-admin-error">{error}</p>}
        {lastInvite && (
          <div className="invite-admin-result">
            <p className="invite-admin-link-row">
              Link: <code className="invite-admin-code">{lastLink}</code>
              <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(lastLink)}>
                Copy
              </Button>
            </p>
            <p>
              Passphrase (for CSV/backup use — this is the only time it's shown):{' '}
              <code className="invite-admin-code">{lastInvite.passphrase}</code>
            </p>
            <Button type="button" variant="secondary" onClick={() => downloadInviteCsv(lastInvite)}>
              Export CSV
            </Button>
          </div>
        )}

        <h3>All invites</h3>
        {invites.length === 0 ? (
          <p className="meta">None yet.</p>
        ) : (
          <ul className="invite-admin-list">
            {invites.map((inv) => (
              <li key={inv.token} className="invite-admin-row">
                <span dir="auto">{inv.label || '(no label)'}</span>
                <span className="meta">
                  {inv.usedAt ? `used by ${inv.usedByUser?.firstName || 'someone'}` : 'unused'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3>Pending device requests</h3>
        {deviceActionError && <p role="alert" className="invite-admin-error">{deviceActionError}</p>}
        {pendingDevices.length === 0 ? (
          <p className="meta">None pending.</p>
        ) : (
          <ul className="invite-admin-list">
            {pendingDevices.map((d) => (
              <li key={d.id} className="invite-admin-row">
                <span dir="auto">
                  {d.user.firstName} {d.user.lastName} ({d.user.email || 'no email'})
                </span>
                <Button type="button" variant="secondary" onClick={() => handleApproveDevice(d)} disabled={workingDeviceId === d.id}>
                  {workingDeviceId === d.id ? 'Working…' : 'Approve'}
                </Button>
                <Button type="button" variant="danger-text" onClick={() => handleRejectDevice(d)} disabled={workingDeviceId === d.id}>
                  Reject
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default InviteAdmin
