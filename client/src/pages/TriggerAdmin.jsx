import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Icon from '../components/Icon'
import './TriggerAdmin.css'

// Trigger/keyword admin UI — live-editable list feeding the
// matching engine. Same minimal pattern as InviteAdmin.jsx: a
// form to add, an inline edit/delete per row, no separate confirm step
// (rename/delete of a keyword is easily reversed by typing it back in,
// unlike an invite or a request status change).
//
// Back button — the app bar's own chevron already covers every non-'list'
// view (see InstallHelp.jsx).
const REQUEST_TYPES = ['TRAVEL', 'RESEARCH', 'PURCHASE', 'TECH_SUPPORT', 'INFO', 'GENERAL']

function TriggerAdmin() {
  const [triggers, setTriggers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0])
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  function loadTriggers() {
    fetch('/api/triggers')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
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
      <Card>
        <h2>Trigger keywords</h2>

        <form onSubmit={handleAdd} className="trigger-admin-form">
          <Input
            id="trigger-admin-keyword"
            type="text"
            placeholder="Keyword or phrase"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            required
          />
          <Select
            id="trigger-admin-type"
            options={REQUEST_TYPES.map((t) => ({ value: t, label: t }))}
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
          />
          <Button type="submit" variant="primary">Add</Button>
        </form>
        {error && <p role="alert" className="trigger-admin-error">{error}</p>}

        <ul className="trigger-admin-list">
          {triggers.map((t) => (
            <li key={t.id} className="trigger-admin-row">
              {editingId === t.id ? (
                <>
                  <Input
                    id={`trigger-admin-edit-${t.id}`}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <Button type="button" variant="icon" onClick={() => handleSaveEdit(t.id)} aria-label="Save">
                    <Icon name="check" />
                  </Button>
                  <Button type="button" variant="icon" onClick={() => setEditingId(null)} aria-label="Cancel">
                    <Icon name="close" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="trigger-admin-keyword" dir="auto">{t.keyword}</span>
                  <span className="meta">{t.requestType}</span>
                  <Button type="button" variant="icon" onClick={() => startEdit(t)} aria-label="Edit">
                    <Icon name="edit" size={18} />
                  </Button>
                  <Button type="button" variant="icon" className="trigger-admin-icon-danger" onClick={() => handleDelete(t.id)} aria-label="Delete">
                    <Icon name="trash" size={18} />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

export default TriggerAdmin
