import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { formatDayLabel, formatTime } from '../lib/format'
import './NotificationHistory.css'

// Notification history page (G411-98) — shows all notifications sent to
// the signed-in user, newest first. Opening the screen marks everything
// read in the background, but unread items still show a visual marker
// for this one viewing (Gavi's follow-up ask) — otherwise the
// distinction would vanish the instant mark-all-read resolves, before
// anyone could ever see it. `wasUnreadIds` is a local-only snapshot,
// taken from the fetch response BEFORE the mark-all-read call, and never
// re-derived from the server afterward.
//
// G411-112: onto the design system. Flat list items instead of
// cards-inside-a-card; the unread marker is now a bold title + leading
// dot rather than a 3px gold left border (flagged as an "AI-UI tell").
// The row's own open-request action and the mark-unread toggle are now
// sibling buttons, not a button nested inside a clickable <li> —
// nested interactive elements are an accessibility problem the old
// markup had (a <button> inside an element with its own role="button").
function NotificationHistory({ onOpenRequest, onCleared }) {
  const [notifications, setNotifications] = useState([])
  const [wasUnreadIds, setWasUnreadIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load your notifications. Try refreshing.")
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

  function toggleUnread(notif) {
    const isCurrentlyMarkedUnread = wasUnreadIds.has(notif.id)
    const method = isCurrentlyMarkedUnread ? 'mark-read' : 'mark-unread'

    fetch(`/api/notifications/${notif.id}/${method}`, { method: 'PATCH' })
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't update that. Try again?")
        setWasUnreadIds((prev) => {
          const next = new Set(prev)
          if (isCurrentlyMarkedUnread) next.delete(notif.id)
          else next.add(notif.id)
          return next
        })
      })
      .catch(() => setError("Couldn't update that. Try again?"))
  }

  // G411-107: clear all notifications
  async function handleClearAll() {
    try {
      const res = await fetch('/api/notifications/clear-all', { method: 'POST' })
      if (!res.ok) throw new Error("Couldn't clear these. Try again?")
      setNotifications([])
      setWasUnreadIds(new Set())
      setError(null)
      onCleared?.()
    } catch {
      setError("Couldn't clear these. Try again?")
    }
  }

  return (
    <div className="notification-history">
      <Card>
        {!loading && notifications.length > 0 && (
          <div className="notification-history-header">
            <h2>Notifications</h2>
            <Button type="button" variant="secondary" onClick={handleClearAll}>
              Clear
            </Button>
          </div>
        )}

        {error && <p role="alert" className="notification-history-error">{error}</p>}

        {loading && <p className="notification-history-status">Loading notifications…</p>}

        {!loading && !error && notifications.length === 0 && (
          <p className="notification-history-status">No notifications yet</p>
        )}

        {!loading && !error && notifications.length > 0 && (
          <ul className="notification-list">
            {notifications.map((notif) => {
              const isUnread = wasUnreadIds.has(notif.id)
              const isClickable = notif.requestId != null
              return (
                <li key={notif.id} className="notification-item">
                  {isClickable ? (
                    <button
                      type="button"
                      className="notification-item-open"
                      onClick={() => onOpenRequest(notif.requestId)}
                    >
                      <NotificationBody notif={notif} isUnread={isUnread} />
                    </button>
                  ) : (
                    <div className="notification-item-open">
                      <NotificationBody notif={notif} isUnread={isUnread} />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="icon"
                    className="notification-item-toggle"
                    onClick={() => toggleUnread(notif)}
                    aria-label={isUnread ? 'Mark read' : 'Mark unread'}
                  >
                    <Icon name={isUnread ? 'check' : 'dot'} size={18} />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function NotificationBody({ notif, isUnread }) {
  return (
    <>
      <div className="notification-item-title-row">
        {isUnread && <span className="notification-item-dot" aria-hidden="true" />}
        <span className={`notification-item-title${isUnread ? ' notification-item-title-unread' : ''}`}>
          {notif.title}
        </span>
      </div>
      <div className="notification-item-body">{notif.body}</div>
      <div className="meta">{formatDayLabel(notif.createdAt)} · {formatTime(notif.createdAt)}</div>
    </>
  )
}

export default NotificationHistory
