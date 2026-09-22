import { useEffect, useRef, useState } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '../lib/webPush'

// Web Push subscription toggle: hamburger menu item for all roles.
// Decision logic exported for testing without duplicating it.
export function pushToggleViewState(pushSupported, notificationPermission, isPushSubscribed) {
  if (pushSupported !== true) return { visible: false }
  if (notificationPermission === 'denied') return { visible: true, denied: true }
  return { visible: true, denied: false, label: isPushSubscribed ? 'Disable notifications' : 'Enable notifications' }
}

// Classify subscription failures: "denied" gets help text, others get error messages.
export function pushToggleErrorOutcome(livePermission, errorMessage) {
  if (livePermission === 'denied') return { becameDenied: true }
  return { becameDenied: false, error: errorMessage || 'Failed to update notifications' }
}

function PushNotificationToggle({ isSignedIn, onClose, onShowDeniedHelp }) {
  // null = still checking support/subscription state, true/false = known
  const [pushSupported, setPushSupported] = useState(null)
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [togglingError, setTogglingError] = useState(null)
  const [togglingInProgress, setTogglingInProgress] = useState(false)

  useEffect(() => {
    if (!isSignedIn) return

    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    if (!supported) {
      setPushSupported(false)
      return
    }

    setNotificationPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setPushSupported(true)
        setIsPushSubscribed(!!subscription)
      })
      .catch(() => setPushSupported(false))
  }, [isSignedIn])

  async function handleToggle() {
    setTogglingError(null)
    setTogglingInProgress(true)
    try {
      if (isPushSubscribed) {
        await unsubscribeFromPush()
        setIsPushSubscribed(false)
      } else {
        const result = await subscribeToPush()
        if (result === null) {
          setPushSupported(false)
        } else {
          setIsPushSubscribed(true)
          setNotificationPermission(Notification.permission)
        }
      }
    } catch (err) {
      const outcome = pushToggleErrorOutcome(Notification.permission, err.message)
      if (outcome.becameDenied) {
        setNotificationPermission('denied')
      } else {
        setTogglingError(outcome.error)
      }
    } finally {
      setTogglingInProgress(false)
    }
  }

  const view = pushToggleViewState(pushSupported, notificationPermission, isPushSubscribed)
  if (!view.visible) return null

  if (view.denied) {
    return (
      <button
        type="button"
        className="hamburger-menu-item"
        onClick={() => {
          onShowDeniedHelp()
          onClose()
        }}
      >
        Notifications blocked in browser settings
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="hamburger-menu-item"
        disabled={togglingInProgress}
        onClick={() => {
          handleToggle()
          onClose()
        }}
      >
        {togglingInProgress ? '…' : view.label}
      </button>
      {togglingError && <p className="push-toggle-error">{togglingError}</p>}
    </>
  )
}

// Help dialog: re-enable steps for notification blocking.
// Rendered at top level to avoid stacking-context issues.
export function DeniedHelpDialog({ open, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog ref={ref} className="denied-help-dialog" onCancel={onClose}>
      <p>
        Your browser is blocking notifications for this site. To turn them
        back on: click the lock or site-info icon next to the address bar,
        find "Notifications", and change it to "Allow" — then come back
        here and try again.
      </p>
      <button type="button" className="hamburger-menu-item" onClick={onClose}>
        Got it
      </button>
    </dialog>
  )
}

export default PushNotificationToggle
