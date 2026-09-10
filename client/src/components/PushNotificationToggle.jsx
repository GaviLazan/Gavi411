import { useEffect, useState } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '../lib/webPush'

// G411-49: hamburger-menu item that subscribes/unsubscribes the signed-in
// user to Web Push. Extracted out of App.jsx so this logic is actually
// renderable in a test (App.jsx itself has no render test in this repo —
// mounting the whole app just to cover one menu item isn't worth it).
// Everyone gets this item (friend + admin) — no role gating.

// Pure decision logic, exported so the test file exercises the real
// function instead of a hand-copied duplicate of it (this codebase has no
// @testing-library/react to actually render JSX — every existing .test.js
// here tests plain logic the same way).
export function pushToggleViewState(pushSupported, notificationPermission, isPushSubscribed) {
  if (pushSupported !== true) return { visible: false }
  if (notificationPermission === 'denied') return { visible: true, denied: true }
  return { visible: true, denied: false, label: isPushSubscribed ? 'Disable notifications' : 'Enable notifications' }
}

function PushNotificationToggle({ isSignedIn, onClose }) {
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
      setTogglingError(err.message || 'Failed to update notifications')
    } finally {
      setTogglingInProgress(false)
    }
  }

  const view = pushToggleViewState(pushSupported, notificationPermission, isPushSubscribed)
  if (!view.visible) return null

  if (view.denied) {
    return (
      <div className="hamburger-menu-item hamburger-menu-item-disabled">
        Notifications blocked in browser settings
      </div>
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

export default PushNotificationToggle
