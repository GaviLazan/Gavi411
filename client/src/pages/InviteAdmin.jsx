import { useEffect, useState } from 'react'

// Minimal admin invite-creation screen (G411-41). Not the full admin
// cockpit (G411-37/38) — just a working trigger for the invite-token
// mechanism: a form to create one, a copy-able resulting link, and a
// list of what's been generated so far.
function InviteAdmin({ onBack }) {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [lastLink, setLastLink] = useState(null)
  const [invites, setInvites] = useState([])

  function loadInvites() {
    fetch('/api/invites')
      .then((res) => res.json())
      .then(setInvites)
      .catch(() => {})
  }

  useEffect(loadInvites, [])

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
      setLastLink(`${window.location.origin}/?token=${invite.token}`)
      setLabel('')
      loadInvites()
    } catch {
      setError('Could not create invite — try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="invite-admin">
      <button type="button" onClick={onBack}>&larr; Back</button>
      <h2>Invites</h2>

      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Note for yourself (optional, e.g. a name)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          dir="auto"
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create invite link'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {lastLink && (
        <p>
          Link: <code>{lastLink}</code>{' '}
          <button type="button" onClick={() => navigator.clipboard.writeText(lastLink)}>
            Copy
          </button>
        </p>
      )}

      <h3>All invites</h3>
      {invites.length === 0 ? (
        <p>None yet.</p>
      ) : (
        <ul>
          {invites.map((inv) => (
            <li key={inv.token}>
              <span dir="auto">{inv.label || '(no label)'}</span>
              {' — '}
              {inv.usedAt
                ? `used by ${inv.usedByUser?.firstName || 'someone'}`
                : 'unused'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default InviteAdmin
