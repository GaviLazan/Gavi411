import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

// Notification history page (G411-98) — shows all notifications sent to
// the signed-in user, newest first. Marks all as read on mount.
function NotificationHistory({ onBack }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch history on mount
    fetch('/api/notifications')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch notifications')
        return res.json()
      })
      .then((data) => {
        setNotifications(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })

    // Mark all as read
    fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {
      // Silently ignore mark-all-read failures — the history still loads
    })
  }, [])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card style={{ width: '100%', textAlign: 'start' }}>
      <Button variant="secondary" onClick={onBack}>
        ← Back
      </Button>

      {error && <p style={{ color: 'var(--color-error)', marginTop: '1rem' }}>Error: {error}</p>}

      {loading && <p style={{ marginTop: '1rem' }}>Loading notifications...</p>}

      {!loading && !error && notifications.length === 0 && (
        <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>No notifications yet</p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
          {notifications.map((notif) => (
            <li
              key={notif.id}
              style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{notif.title}</div>
              <div style={{ marginBottom: '0.5rem' }}>{notif.body}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {formatDate(notif.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default NotificationHistory
