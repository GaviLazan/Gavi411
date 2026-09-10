import { useEffect, useState } from 'react'
import './AdminCreateRequest.css'

// Admin creates a request on behalf of an existing user (G411-44).
function AdminCreateRequest({ onBack }) {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [freeText, setFreeText] = useState('')
  const [chargeCredit, setChargeCredit] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  // G411-46: tier control
  const [tierUserId, setTierUserId] = useState('')
  const [tierValue, setTierValue] = useState('REGULAR')
  const [tierUpdating, setTierUpdating] = useState(false)
  const [tierError, setTierError] = useState(null)
  const [tierSuccess, setTierSuccess] = useState(null)

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

  async function handleTierUpdate(e) {
    e.preventDefault()
    setTierError(null)
    setTierSuccess(null)
    setTierUpdating(true)

    try {
      const res = await fetch(`/api/requests/users/${tierUserId}/group-tag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupTag: tierValue }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not update tier')
      }

      // Tier change adjusts creditBalance immediately (not just at next
      // reset) — show the resulting balance so the effect is visible.
      const body = await res.json()
      setTierSuccess(`Tier updated — new balance: ${body.creditBalance}`)
      setTierUserId('')
      setTierValue('REGULAR')
    } catch (err) {
      setTierError(err.message)
    } finally {
      setTierUpdating(false)
    }
  }

  return (
    <div className="admin-create-request">
      <button type="button" onClick={onBack}>&larr; Back</button>
      <h2>New request</h2>

      <form onSubmit={handleSubmit}>
        <label>
          For which friend?
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">Select a friend</option>
            {users.map((u) => (
              <option key={u.clerkId} value={u.clerkId}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Request text
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Paste or type the request content"
            dir="auto"
            required
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={chargeCredit}
            onChange={(e) => setChargeCredit(e.target.checked)}
          />
          Charge a credit for this request
        </label>

        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create request'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {successMessage && <p role="status">{successMessage}</p>}

      {/* G411-46: minimal tier control for unblocking monthly reset job */}
      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ccc' }}>
        <h3>Set a friend's tier</h3>
        <form onSubmit={handleTierUpdate}>
          <label>
            Friend
            <select
              value={tierUserId}
              onChange={(e) => setTierUserId(e.target.value)}
              required
            >
              <option value="">Select a friend</option>
              {users.map((u) => (
                <option key={u.clerkId} value={u.clerkId}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tier
            <select value={tierValue} onChange={(e) => setTierValue(e.target.value)}>
              <option value="LIMITED">Acquaintance (2 credits)</option>
              <option value="REGULAR">Regular (5 credits)</option>
              <option value="CLOSE">Close (7 credits)</option>
            </select>
          </label>

          <button type="submit" disabled={tierUpdating}>
            {tierUpdating ? 'Saving…' : 'Save'}
          </button>
        </form>

        {tierError && <p role="alert">{tierError}</p>}
        {tierSuccess && <p role="status">{tierSuccess}</p>}
      </div>
    </div>
  )
}

export default AdminCreateRequest
