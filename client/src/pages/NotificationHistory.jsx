import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import './NotificationHistory.css'

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

      {error && <p className="notification-history-error">Error: {error}</p>}

      {loading && <p className="notification-history-status">Loading notifications...</p>}

      {!loading && !error && notifications.length === 0 && (
        <p className="notification-history-status">No notifications yet</p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((notif) => (
            <li key={notif.id} className="notification-item">
              <div className="notification-item-title">{notif.title}</div>
              <div className="notification-item-body">{notif.body}</div>
              <div className="notification-item-date">{formatDate(notif.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default NotificationHistory
