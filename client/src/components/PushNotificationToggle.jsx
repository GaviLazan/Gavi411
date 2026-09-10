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

// Decides what a subscribeToPush()/unsubscribeFromPush() failure should
// do to the UI. Gavi, live testing: a first-ever subscribe click can hit
// the browser's native permission prompt right there, and clicking
// "Block" throws the browser's own generic error — that's the same
// "denied" case the view already has real help text for, not some other
// failure that should show a raw error message with no path to a fix.
export function pushToggleErrorOutcome(livePermission, errorMessage) {
  if (livePermission === 'denied') return { becameDenied: true }
  return { becameDenied: false, error: errorMessage || 'Failed to update notifications' }
}

// isSignedIn: gates the subscription-state check. onClose: closes the
// hamburger menu (existing pattern, every menu item does this on click).
// onShowDeniedHelp: opens DeniedHelpDialog below — rendered by the
// caller (App.jsx) as a top-level sibling, NOT nested in here. A native
// <dialog> showModal() inside an ancestor with a running CSS animation/
// transform (HamburgerMenu's own slide-in) doesn't reliably promote to
// the top layer — it was rendering trapped inside the menu panel and
// vanishing the instant the menu closed (Gavi, live testing). Same
// reason ConfirmModal itself is a top-level sibling in App.jsx, not
// nested inside whatever triggered it.
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

// Generic re-enable steps, not browser-sniffed — the exact menu wording
// varies by browser, but "click the site-info/lock icon next to the
// address bar" is the one instruction that's true almost everywhere, and
// UA-sniffing a full per-browser decision tree is more than this ticket
// needs (real copy pass is Epic 9, deliberately deferred). Native
// <dialog> + showModal(), same open/close-effect pattern as
// ConfirmModal.jsx — and rendered by the CALLER as a top-level sibling,
// same as ConfirmModal itself, not nested inside HamburgerMenu (see the
// comment on PushNotificationToggle above for why).
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
