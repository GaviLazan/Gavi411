import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import './NotificationHistory.css'

// Notification history page (G411-98) — shows all notifications sent to
// the signed-in user, newest first. Opening the screen marks everything
// read in the background, but unread items still show a visual marker
// for this one viewing (Gavi's follow-up ask) — otherwise the
// distinction would vanish the instant mark-all-read resolves, before
// anyone could ever see it. `wasUnreadIds` is a local-only snapshot,
// taken from the fetch response BEFORE the mark-all-read call, and never
// re-derived from the server afterward.
function NotificationHistory({ onBack, onOpenRequest, onCleared }) {
  const [notifications, setNotifications] = useState([])
  const [wasUnreadIds, setWasUnreadIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch notifications')
        return res.json()
      })
      .then((data) => {
        setNotifications(data)
        setWasUnreadIds(new Set(data.filter((n) => !n.readAt).map((n) => n.id)))
        setLoading(false)
        // Mark all as read only after the unread snapshot above is taken
        // — doing this in parallel with the fetch (as before) races it:
        // if mark-all-read resolves first, every row would already read
        // as read by the time the snapshot is taken, and the marker
        // would never show at all.
        fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {
          // Silently ignore — the history still loaded fine either way.
        })
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  function toggleUnread(notif, event) {
    if (event) event.stopPropagation()
    const isCurrentlyMarkedUnread = wasUnreadIds.has(notif.id)
    const method = isCurrentlyMarkedUnread ? 'mark-read' : 'mark-unread'

    fetch(`/api/notifications/${notif.id}/${method}`, { method: 'PATCH' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update notification')
        setWasUnreadIds((prev) => {
          const next = new Set(prev)
          if (isCurrentlyMarkedUnread) next.delete(notif.id)
          else next.add(notif.id)
          return next
        })
      })
      .catch(() => setError('Failed to update notification'))
  }

  // G411-107: clear all notifications
  async function handleClearAll() {
    try {
      const res = await fetch('/api/notifications/clear-all', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to clear notifications')
      setNotifications([])
      setWasUnreadIds(new Set())
      setError(null)
      onCleared?.()
    } catch {
      setError('Failed to clear notifications')
    }
  }

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
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        {!loading && notifications.length > 0 && (
          <Button variant="secondary" onClick={handleClearAll}>
            Clear
          </Button>
        )}
      </div>

      {error && <p className="notification-history-error">Error: {error}</p>}

      {loading && <p className="notification-history-status">Loading notifications...</p>}

      {!loading && !error && notifications.length === 0 && (
        <p className="notification-history-status">No notifications yet</p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((notif) => {
            const isUnread = wasUnreadIds.has(notif.id)
            const isClickable = notif.requestId != null
            return (
              <li
                key={notif.id}
                className={`notification-item${isUnread ? ' notification-item-unread' : ''}${isClickable ? ' notification-item-clickable' : ''}`}
                onClick={() => isClickable && onOpenRequest(notif.requestId)}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onOpenRequest(notif.requestId)
                  }
                }}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
              >
                <div className="notification-item-header">
                  <div className="notification-item-title">{notif.title}</div>
                  <button
                    type="button"
                    className="notification-item-toggle"
                    onClick={(e) => toggleUnread(notif, e)}
                  >
                    {isUnread ? 'Mark read' : 'Mark unread'}
                  </button>
                </div>
                <div className="notification-item-body">{notif.body}</div>
                <div className="notification-item-date">{formatDate(notif.createdAt)}</div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default NotificationHistory
