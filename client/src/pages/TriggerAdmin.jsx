import { useEffect, useState } from 'react'

// Trigger/keyword admin UI (G411-42) — live-editable list feeding the
// matching engine (G411-19). Same minimal, unstyled pattern as
// InviteAdmin.jsx: a form to add, an inline edit/delete per row, no
// separate confirm step (rename/delete of a keyword is easily reversed
// by typing it back in, unlike an invite or a request status change).
const REQUEST_TYPES = ['TRAVEL', 'RESEARCH', 'PURCHASE', 'TECH_SUPPORT', 'INFO', 'GENERAL']

function TriggerAdmin({ onBack }) {
  const [triggers, setTriggers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0])
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  function loadTriggers() {
    fetch('/api/triggers')
      .then((res) => res.json())
      .then(setTriggers)
      .catch(() => setError('Could not load triggers.'))
  }

  useEffect(loadTriggers, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), requestType }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to add')
      }
      setKeyword('')
      loadTriggers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    setError(null)
    try {
      const res = await fetch(`/api/triggers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      loadTriggers()
    } catch {
      setError('Could not delete — try again.')
    }
  }

  function startEdit(trigger) {
    setEditingId(trigger.id)
    setEditValue(trigger.keyword)
    setError(null)
  }

  async function handleSaveEdit(id) {
    setError(null)
    try {
      const res = await fetch(`/api/triggers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: editValue.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save')
      }
      setEditingId(null)
      loadTriggers()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="trigger-admin">
      <button type="button" onClick={onBack}>&larr; Back</button>
      <h2>Trigger keywords</h2>

      <form onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Keyword or phrase"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          dir="auto"
          required
        />
        <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
          {REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>
      {error && <p role="alert">{error}</p>}

      <ul>
        {triggers.map((t) => (
          <li key={t.id}>
            {editingId === t.id ? (
              <>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  dir="auto"
                  autoFocus
                />
                <button type="button" onClick={() => handleSaveEdit(t.id)}>Save</button>
                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span dir="auto">{t.keyword}</span> — {t.requestType}{' '}
                <button type="button" onClick={() => startEdit(t)}>Edit</button>
                <button type="button" onClick={() => handleDelete(t.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TriggerAdmin
