import { useEffect, useState } from 'react'
import { downloadInviteCsv } from '../lib/inviteCsv'
import { createAndUploadKeypair } from '../lib/escrow'
import { getPendingDevices, approveDevice, rejectDevice } from '../lib/deviceLinking'
import { loadPrivateKey } from '../lib/keyStore'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import './InviteAdmin.css'

// Minimal admin invite-creation screen (G411-41; escrow passphrase + CSV
// export added G411-28 stage 4). Not the full admin cockpit (G411-37/38)
// — just a working trigger for the invite-token mechanism: a form to
// create one, a copy-able resulting link, and a list of what's been
// generated so far.
//
// G411-112: onto the design system (Card/Button/Input). No in-page Back
// button — the app bar's own chevron already covers every non-'list' view
// (see InstallHelp.jsx).
function InviteAdmin() {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  // The passphrase only ever exists in this one POST response — captured
  // here alongside the link so the CSV export button (right below) can
  // still source it, then gone once this component unmounts/re-creates.
  // See prisma/schema.prisma's PendingInvite comment for why it's never
  // persisted anywhere to be fetched again later.
  const [lastInvite, setLastInvite] = useState(null) // { token, label, passphrase }
  const [invites, setInvites] = useState([])

  // G411-82 admin bootstrap: the only account that never went through
  // the real invite-signup flow (it predates invites entirely) is Gavi's
  // own admin account, so it has no messaging keypair. The "no separate
  // sign-in bootstrap for existing/regular users" rule (Jira pickup
  // comment) is specifically about NOT doing this automatically for
  // everyone — this is a one-off, admin-only, self-service button, not a
  // background bootstrap. Anyone can trigger this from their own signed-
  // in session for their own account, but it only shows once (hidden as
  // soon as /api/me reports a publicKey already on file), so it's not a
  // standing "regenerate my key" control.
  const [hasPublicKey, setHasPublicKey] = useState(true) // assume yes until checked, avoids a flash
  const [keypairStatus, setKeypairStatus] = useState('idle') // 'idle' | 'working' | 'error'
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

  // Device-linking (G411-28, 2026-09-01) — bare-minimum admin UI, real
  // cockpit is G411-37/38's job (see that ticket's own comment pointing
  // back here). Just enough to actually exercise the approve/reject
  // routes: a flat list, no per-request breakdown.
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
      // Sibling review finding (critical): this used to wrap EVERY
      // request in the system for the new device — since /api/requests
      // returns every friend's requests to an admin caller, that handed
      // a newly-linked device decrypt access to every other friend's
      // private conversations, not just its own account's. Scoped to
      // device.userId's own requests only — that's the actual account
      // this device belongs to.
      const requests = await fetch('/api/requests').then((res) => res.json())
      const requestIds = requests.filter((r) => r.userId === device.userId).map((r) => r.id)
      const { skippedRequestIds } = await approveDevice(device, adminPrivateKey, requestIds)
      if (skippedRequestIds.length > 0) {
        // Sibling review finding: a skipped conversation (friend has no
        // public key yet) used to be silent and permanent — no re-run
        // trigger exists once a device is APPROVED, so at minimum admin
        // needs to know it happened.
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

  // The passphrase goes in the URL fragment (#), never the query string —
  // fragments are never sent to the server (see lib/inviteToken.js), so
  // this is the one place it's safe for the link to carry it in plain text.
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

        {/* G411-28 device-linking — bare-minimum shim, real cockpit is
            G411-37/38's job (see that ticket for the pointer back here). */}
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
