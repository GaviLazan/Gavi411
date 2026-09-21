import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Select from '../components/Select'
import './AdminCreateRequest.css'

// Admin creates a request on behalf of an existing user (G411-44).
//
// G411-112: onto the design system (Card/Button/Input/Select). Also drops
// the "Set a friend's tier" section (G411-46) — a stopgap bolted on here
// before UserManagement (G411-99) existed, calling the exact same
// PATCH .../group-tag endpoint UserManagement's own per-user Group Tag
// select already covers. Gavi's direct call: keep the real editor in
// UserManagement, remove the duplicate here. No in-page Back button — the
// app bar's own chevron already covers every non-'list' view.
function AdminCreateRequest() {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [freeText, setFreeText] = useState('')
  const [chargeCredit, setChargeCredit] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Load the list of users for the dropdown
  useEffect(() => {
    fetch('/api/requests/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(setUsers)
      .catch(() => setError('Could not load users.'))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setCreating(true)

    try {
      const res = await fetch('/api/requests/admin-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          freeText,
          chargeCredit,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not create request')
      }

      setSuccessMessage('Request created')
      setFreeText('')
      setChargeCredit(false)
      // Don't auto-navigate; let admin decide when to go back
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="admin-create-request">
      <Card>
        <h2>New request</h2>

        <form onSubmit={handleSubmit}>
          <Select
            id="admin-create-request-user"
            label="For which friend?"
            options={[
              { value: '', label: 'Select a friend' },
              ...users.map((u) => ({ value: u.clerkId, label: `${u.firstName} ${u.lastName}` })),
            ]}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          />

          <label className="admin-create-request-field">
            <span className="field-label">Request text</span>
            <textarea
              className="field-input admin-create-request-textarea"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Paste or type the request content"
              dir="auto"
              required
            />
          </label>

          <label className="admin-create-request-checkbox-row">
            <input
              type="checkbox"
              checked={chargeCredit}
              onChange={(e) => setChargeCredit(e.target.checked)}
            />
            Charge a credit for this request
          </label>

          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create request'}
          </Button>
        </form>

        {error && <p role="alert" className="admin-create-request-error">{error}</p>}
        {successMessage && <p role="status">{successMessage}</p>}
      </Card>
    </div>
  )
}

export default AdminCreateRequest
