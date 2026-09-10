import { useEffect, useRef, useState } from 'react'
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
  const [showDeniedHelp, setShowDeniedHelp] = useState(false)

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
      <>
        <button
          type="button"
          className="hamburger-menu-item"
          onClick={() => setShowDeniedHelp(true)}
        >
          Notifications blocked in browser settings
        </button>
        {showDeniedHelp && (
          <DeniedHelpDialog onClose={() => setShowDeniedHelp(false)} />
        )}
      </>
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

// Generic re-enable steps, not browser-sniffed — the exact menu wording
// varies by browser, but "click the site-info/lock icon next to the
// address bar" is the one instruction that's true almost everywhere, and
// UA-sniffing a full per-browser decision tree is more than this ticket
// needs (real copy pass is Epic 9, deliberately deferred). Native
// <dialog> + showModal(), same pattern as ConfirmModal.jsx.
function DeniedHelpDialog({ onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  function handleClose() {
    ref.current?.close()
    onClose()
  }

  return (
    <dialog ref={ref} className="denied-help-dialog" onCancel={handleClose}>
      <p>
        Your browser is blocking notifications for this site. To turn them
        back on: click the lock or site-info icon next to the address bar,
        find "Notifications", and change it to "Allow" — then come back
        here and try again.
      </p>
      <button type="button" className="hamburger-menu-item" onClick={handleClose}>
        Got it
      </button>
    </dialog>
  )
}

export default PushNotificationToggle
