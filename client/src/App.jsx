import { useState, useEffect, useRef } from 'react'
import { useUser, useClerk, SignIn, SignUp, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'
import AdminList from './pages/AdminList'
import RequestDetail from './pages/RequestDetail'
import InstallHelp from './pages/InstallHelp'
import InviteAdmin from './pages/InviteAdmin'
import TriggerAdmin from './pages/TriggerAdmin'
import AdminCreateRequest from './pages/AdminCreateRequest'
import CompleteProfile from './pages/CompleteProfile'
import ProfilePage from './pages/ProfilePage'
import UserManagement from './pages/UserManagement'
import NotificationHistory from './pages/NotificationHistory'
import ConfirmModal from './components/ConfirmModal'
import HamburgerMenu from './components/HamburgerMenu'
import Button from './components/Button'
import Icon from './components/Icon'
import { useTheme } from './useTheme'
import Recover from './pages/Recover'
import FriendRequestsList from './pages/FriendRequestsList'
import FriendHome from './pages/FriendHome'
import { CLOSED_STATUSES } from './lib/requestStatus'
import {
  captureInviteTokenFromUrl,
  getStashedInviteToken,
  clearStashedInviteToken,
  getStashedInvitePassphrase,
  clearStashedInvitePassphrase,
  captureRecoveryParamsFromUrl,
  getStashedRecoveryParams,
  clearStashedRecoveryParams,
  captureRequestPermalinkFromUrl,
  getStashedRequestPermalink,
  clearStashedRequestPermalink,
  canConsumeRequestPermalink,
} from './lib/inviteToken'
import { createAndUploadEscrowBackup, createAndUploadKeypair } from './lib/escrow'
import { loadLinkedConversationKeys, wrapMissingConversationKeys } from './lib/deviceLinking'
import { seedLinkedConversationKeys } from './lib/conversationCrypto'
import { loadPrivateKey } from './lib/keyStore'
import { E2E_ENABLED } from './lib/e2eConfig'
import PushNotificationToggle, { DeniedHelpDialog } from './components/PushNotificationToggle'

// G411-41: stash any ?token= before Clerk's own redirect flow can touch
// the URL — see client/src/lib/inviteToken.js for why sessionStorage,
// not the URL param itself, carries the token through an OAuth round trip.
captureInviteTokenFromUrl()
// G411-28 stage 4: same reasoning, same moment, for a ?recover= link —
// Sibling review finding, a lost/new device opening a recovery link is
// just as likely to be signed OUT (hitting the same OAuth hazard) as a
// brand-new signup is.
captureRecoveryParamsFromUrl()
// G411-94: capture /r/<publicId> permalink URLs for later consumption
// after sign-in completes (unlike invite tokens, the URL stays visible).
captureRequestPermalinkFromUrl()

const THEME_LABEL = { light: 'Light', dark: 'Dark' }

// Mirrors server/lib/credits.js's INITIAL_CREDITS (PRD §9's monthly tier
// caps) — kept as a small client-side copy rather than importing the
// server module, since it's a 3-entry constant map, not worth a shared
// package for. Used only for the credit-balance tooltip's "x/y" cap.
const CREDIT_CAP_BY_TIER = { LIMITED: 2, REGULAR: 5, CLOSE: 7 }

// G411-106: sessionStorage keys for persisting view state across reloads
const VIEW_STORAGE_KEY = 'gavi411_view_state'

// G411-66: gate real content behind Clerk auth state.
// NOTE: this project's installed package is "@clerk/react" (a lower-level
// package), not "@clerk/clerk-react" — it does not export SignedIn/SignedOut
// components. Same auth-state gating, done with the useUser hook instead
// (native to the already-installed package, no new dependency).
// Signed-out visitors get Clerk's hosted SignIn component instead of the
// intake form.
//
// G411-67: view switching is plain useState, not a router — only 3
// screens exist (list/new/install-help), a router dependency isn't
// justified at this size. Add one if the screen count grows enough to
// need real URLs/back-button support.
function App() {
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  // G411-106: restore view state from sessionStorage on mount, but only if
  // no permalink is being consumed (permalink flow takes precedence)
  const [view, setView] = useState(() => {
    const hasPermalink = Boolean(getStashedRequestPermalink())
    if (hasPermalink) return 'list'
    try {
      const saved = sessionStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) {
        const { view: savedView } = JSON.parse(saved)
        return savedView || 'list'
      }
    } catch {}
    return 'list'
  })
  const [selectedRequestId, setSelectedRequestId] = useState(() => {
    const hasPermalink = Boolean(getStashedRequestPermalink())
    if (hasPermalink) return null
    try {
      const saved = sessionStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) {
        const { selectedRequestId: savedId } = JSON.parse(saved)
        return savedId || null
      }
    } catch {}
    return null
  })
  const [newRequestHasText, setNewRequestHasText] = useState(false)
  const [showLogoDiscardConfirm, setShowLogoDiscardConfirm] = useState(false)
  // G411-49 fix: DeniedHelpDialog must render as a top-level sibling, not
  // nested inside HamburgerMenu — see PushNotificationToggle.jsx's comment.
  const [showPushDeniedHelp, setShowPushDeniedHelp] = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  // G411-108: lets the app-bar back button trigger ProfilePage's real exit
  // logic (Clerk sync, when actually needed — see ProfilePage's own
  // handleBack) instead of a plain setView when view === 'profile'.
  const profilePageRef = useRef(null)
  const [unreadCount, setUnreadCount] = useState(0)
  // G411-106: restore previousView from sessionStorage on mount
  const [previousView, setPreviousView] = useState(() => {
    try {
      const saved = sessionStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) {
        const { previousView: savedPrevious } = JSON.parse(saved)
        return savedPrevious || 'list'
      }
    } catch {}
    return 'list'
  })
  const { theme, cycleTheme } = useTheme()
  const [isOnline, setIsOnline] = useState(true)
  const [presenceToggling, setPresenceToggling] = useState(false)
  // Sibling review finding: a failed PATCH (network blip, cold-start
  // timeout) used to silently re-enable the button with the stale label
  // and zero feedback — same silent-failure class already fixed for
  // roleFetchFailed/escrowBackupFailed elsewhere in this file.
  const [presenceToggleError, setPresenceToggleError] = useState(false)
  const [adminOpenCount, setAdminOpenCount] = useState(null)

  // G411-43: fetch and display current presence status on mount
  // (every signed-in user should see whether Gavi is online)
  useEffect(() => {
    fetch('/api/presence')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setIsOnline(data.isOnline))
      .catch(() => {}) // silently default to true on network error
  }, [])

  // Sibling review finding: a stashed token's mere PRESENCE isn't the
  // same as it being valid — a stale/already-used invite link used to
  // route straight into a real Clerk SignUp flow (only 403ing on the
  // first backend call afterward), creating an orphaned Clerk identity
  // for a link that was never going to work. Actually check validity
  // (the existing /:token/valid route, no auth required — same one this
  // signed-out visitor's browser can already reach) before deciding.
  // 'checking' | 'valid' | 'invalid'
  const [inviteTokenState, setInviteTokenState] = useState('checking')
  useEffect(() => {
    if (isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) {
      setInviteTokenState('invalid')
      return
    }
    fetch(`/api/invites/${encodeURIComponent(token)}/valid`)
      .then((res) => res.json())
      .then((data) => setInviteTokenState(data.valid ? 'valid' : 'invalid'))
      .catch(() => setInviteTokenState('invalid'))
  }, [isSignedIn])

  // Sibling review finding: /api/me's role check and RequestList's own
  // /api/requests fetch used to fire in the same render pass as this
  // token handoff, racing it — whichever reached requireAuth first for a
  // brand-new user decided the outcome, so a legitimate signup could get
  // wrongly 403'd if a header-less request won. Fix: nothing else that
  // needs auth renders/fires until this handoff has settled (or there
  // was nothing to send). Starts true when there's no stashed token —
  // only signups need to wait.
  const [tokenHandoffDone, setTokenHandoffDone] = useState(() => !getStashedInviteToken())
  // Sibling review finding: escrow upload failures were only logged to
  // the console — a friend on a flaky connection got zero recoverable
  // backup with no indication anything went wrong. A disaster-recovery
  // feature failing silently is worse than not having it; this is a
  // one-line dismissible notice, not a blocker (see escrow.js's own doc
  // comment — the crypto subsystem is still standalone/non-critical-path,
  // so a failure here shouldn't stop the friend from using the app).
  // Declared here (before the effect that sets it) — used to sit below
  // it, which the linter flagged as reading state ahead of its own
  // initialization.
  const [escrowBackupFailed, setEscrowBackupFailed] = useState(false)

  // G411-28 device-linking: once per sign-in, check whether this device
  // has any approved-but-not-yet-loaded conversation keys and seed them
  // into conversationCrypto.js's cache. A no-op (empty Map) for every
  // device that never requested linking — see deviceLinking.js.
  useEffect(() => {
    if (!isSignedIn) return
    loadLinkedConversationKeys().then(seedLinkedConversationKeys).catch(() => {})
  }, [isSignedIn])

  useEffect(() => {
    if (!isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) {
      setTokenHandoffDone(true)
      return
    }
    // AbortController (Sibling review finding): React StrictMode (dev)
    // double-invokes this effect on mount, which would otherwise fire
    // TWO real network requests carrying the same one-time-use token —
    // the server's atomic claim correctly lets only one through, but the
    // other genuinely races it rather than being cancelled. Aborting the
    // first request on cleanup (StrictMode's mount->cleanup->mount) means
    // only the second, real invocation's request actually reaches the
    // server — no duplicate claim to reconcile at all, standard fix for
    // this exact StrictMode double-effect pattern.
    const controller = new AbortController()
    let claimSucceeded = false
    fetch('/api/requests', { headers: { 'x-invite-token': token }, signal: controller.signal })
      .then((res) => { claimSucceeded = res.ok })
      .catch(() => {}) // AbortError on cleanup is expected, not a real failure
      .finally(async () => {
        if (controller.signal.aborted) return
        clearStashedInviteToken()
        // Keypair generation (G411-82): every successful signup gets a
        // real E2E-messaging keypair, whether or not this invite link
        // carried an escrow passphrase — previously ONLY the escrow
        // branch (below) ever called a keygen function, so a
        // no-passphrase link (stale/stripped fragment) left that user
        // with zero keypair, permanently, until this fix. Escrow (if a
        // passphrase IS present) generates its own keypair internally
        // and uploads both the backup and the public key; the plain path
        // here does the same minus the backup. Same claim-succeeded gate
        // as before — no point generating a device identity for a signup
        // that never actually went through.
        const passphrase = getStashedInvitePassphrase()
        if (claimSucceeded && passphrase) {
          const ok = await createAndUploadEscrowBackup(token, passphrase)
          if (!ok) setEscrowBackupFailed(true)
        } else if (claimSucceeded) {
          const ok = await createAndUploadKeypair()
          if (!ok) setEscrowBackupFailed(true)
        }
        clearStashedInvitePassphrase()
        // Re-check after the await above (Sibling review finding — the
        // original single check before the async escrow call no longer
        // covered an abort that happens mid-upload).
        if (controller.signal.aborted) return
        setTokenHandoffDone(true)
      })
    return () => controller.abort()
  }, [isSignedIn])

  // G411-41: role isn't on the Clerk user object (it's our own Prisma
  // field) — fetch it once via the existing /api/me smoke-test route
  // (G411-13) rather than adding a new endpoint just for this. A 403
  // here means Clerk auth succeeded but our own backend never created a
  // User row (see server/middleware/auth.js) — no valid invite.
  const [role, setRole] = useState(null)
  // Derived once, used everywhere role gates a decision (Sibling review
  // finding — `role === 'ADMIN'` was independently re-derived at 3
  // separate call sites in this file with no shared source).
  const isAdmin = role === 'ADMIN'
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false)
  const [userProfilePic, setUserProfilePic] = useState(null)
  // G411-80: store the full user object from /api/me for the ProfilePage
  const [fetchedUser, setFetchedUser] = useState(null)
  const [unauthorized, setUnauthorized] = useState(false)
  // Sibling review finding: a thrown /api/me fetch (network blip, Render
  // cold-start timeout) used to be silently swallowed by an empty catch,
  // leaving `role` at null forever — combined with the role===null "wait
  // for role" gate below (added to fix a remount flash), that stranded
  // ANY signed-in user on a permanent "Loading…" with no way out. Real
  // error state + retry instead, same pattern AdminList/RequestList
  // already use for their own fetch failures.
  const [roleFetchFailed, setRoleFetchFailed] = useState(false)
  const [roleRetryToken, setRoleRetryToken] = useState(0)
  // Bumped when a push notification arrives (see the BroadcastChannel
  // listener below) so an already-open Open/Closed requests list
  // refetches instead of going stale until a manual reload — separate
  // from roleRetryToken so a push doesn't also trigger an unrelated
  // /api/me refetch.
  const [pushRefreshToken, setPushRefreshToken] = useState(0)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('gavi411-push')
    channel.onmessage = () => setPushRefreshToken((t) => t + 1)
    return () => channel.close()
  }, [])
  // AdminList stays mounted-hidden across nav (G411-89) rather than
  // remounting, so switching back to Open/Closed requests doesn't refetch
  // on its own the way a fresh mount would — bump on becoming visible
  // (view changes TO one of these), not on every internal filter/sort
  // change within AdminList itself, which isn't a `view` change at all.
  useEffect(() => {
    if (view === 'open-requests' || view === 'closed-requests') {
      setPushRefreshToken((t) => t + 1)
    }
  }, [view])

  // G411-103: unread-notification dot on the hamburger icon. Reuses
  // pushRefreshToken (already bumps when a push arrives via the SW's
  // BroadcastChannel, or on navigating to Open/Closed requests) rather
  // than a separate timer poll — updates the moment a push lands in an
  // open tab, plus once on load/sign-in, with no new polling.
  useEffect(() => {
    if (!isSignedIn || !tokenHandoffDone) return
    fetch('/api/notifications/unread-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUnreadCount(data.count)
      })
      .catch(() => {})
  }, [isSignedIn, tokenHandoffDone, pushRefreshToken])
  // G411-28 stage 4: a ?recover=<token>#<passphrase> link, stashed by
  // captureRecoveryParamsFromUrl() above the same way the signup token
  // is — read once here, doesn't need to react to later URL changes.
  const [recovery, setRecovery] = useState(getStashedRecoveryParams)
  useEffect(() => {
    if (!isSignedIn || !tokenHandoffDone) return
    setRoleFetchFailed(false)
    fetch('/api/me')
      .then((res) => {
        if (res.status === 403) {
          setUnauthorized(true)
          return null
        }
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((data) => {
        if (data) {
          setRole(data.user?.role ?? null)
          // G411-69: check if user needs to complete profile (phone still pending)
          const phoneNumber = data.user?.phoneNumber
          setNeedsProfileCompletion(phoneNumber?.startsWith('pending-') ?? false)
          setUserProfilePic(data.user?.profilePic ?? null)
          // G411-80: store the full user object for ProfilePage access
          setFetchedUser(data.user)
        }
      })
      .catch(() => setRoleFetchFailed(true))
  }, [isSignedIn, tokenHandoffDone, roleRetryToken])

  // Matan's Sibling review, PR #35, Fix 1a: self-healing sweep, admin
  // side. Only admin's browser ever holds the private key needed to wrap
  // a conversation key for a linked device, so this can't run until
  // `role` resolves to ADMIN — a regular friend's browser has nothing to
  // contribute here (they only ever consume already-wrapped keys, via
  // loadLinkedConversationKeys above). Best-effort, silently no-ops on
  // any failure — see wrapMissingConversationKeys's own doc comment.
  useEffect(() => {
    if (!E2E_ENABLED || role !== 'ADMIN') return
    loadPrivateKey().then((key) => {
      if (key) wrapMissingConversationKeys(key)
    })
  }, [role])

  // G411-106: persist view state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      view,
      selectedRequestId,
      previousView,
    }))
  }, [view, selectedRequestId, previousView])

  // G411-94: open a request detail view given its real numeric ID.
  // Factored as a named function so both the permalink-consume effect
  // and future notification handlers (G411-102) can reuse it without duplication.
  function openRequest(requestId) {
    setSelectedRequestId(requestId)
    setPreviousView('list')
    setView('detail')
  }

  // G411-102: listen for notification clicks from service worker to deep-link into a request
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function handleMessage(event) {
      if (event.data?.type === 'notification-click' && event.data.requestId != null) {
        openRequest(event.data.requestId)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])

  // G411-94: a permalink that 404s (unknown id, or a request this user
  // can't access) used to fail completely silently — the fetch's own
  // .catch cleared the stash and did nothing else, so the user just saw
  // the ordinary home screen with zero indication anything had happened,
  // indistinguishable from a broken link. Surfaced live testing this
  // exact case (Second Party opening a permalink to admin's request).
  const [permalinkError, setPermalinkError] = useState(false)
  // G411-94: true from first render whenever a permalink is stashed and
  // still unresolved — suppresses the home screen's real content so it
  // doesn't visibly flash before the effect below can redirect into the
  // request (live testing found this exact flash: home screen for a
  // moment, then the request "popped in" once the lookup fetch resolved).
  const [pendingPermalink, setPendingPermalink] = useState(() => Boolean(getStashedRequestPermalink()))

  // G411-94: consume stashed request permalink URL once auth gates clear.
  // Only fires when ALL conditions are true: signed in, token handoff done,
  // role resolved, profile complete (admin exempt, matching the render
  // gate at the `needsProfileCompletion && !isAdmin` branch below — admin's
  // phoneNumber is permanently the pending- placeholder by design, so a
  // plain `needsProfileCompletion` check here left this effect stuck
  // forever for admin, silently never consuming any permalink), and no
  // recovery in progress. Live-tested finding, not caught by any test —
  // this repo's convention has no @testing-library/react to render the
  // real gate combination.
  useEffect(() => {
    if (
      !canConsumeRequestPermalink({
        isSignedIn,
        tokenHandoffDone,
        role,
        isAdmin,
        needsProfileCompletion,
        recoveryToken: recovery.token,
      })
    )
      return

    const publicId = getStashedRequestPermalink()
    if (!publicId) {
      setPendingPermalink(false)
      return
    }

    fetch(`/api/requests/by-public-id/${encodeURIComponent(publicId)}`)
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Failed to load request')
      })
      .then((request) => {
        if (request) {
          openRequest(request.id)
          clearStashedRequestPermalink()
        }
      })
      .catch(() => {
        // On error (404, network failure, etc.) clear the stale permalink
        // so it doesn't re-fire, and tell the user rather than silently
        // dropping them on the home screen with no explanation.
        clearStashedRequestPermalink()
        setPermalinkError(true)
      })
      .finally(() => setPendingPermalink(false))
  }, [isSignedIn, tokenHandoffDone, role, isAdmin, needsProfileCompletion, recovery.token])

  // Admin's open request count for home screen display, derived from
  // AdminList's own already-fetched data (via onRequestsLoaded) instead
  // of a second independent /api/requests fetch (Sibling review finding,
  // G411-95: AdminList is mounted unconditionally for every admin, so a
  // separate fetch here doubled every admin's list load). This also
  // fixes the count never refreshing after first load — it now recomputes
  // whenever AdminList refetches (e.g. its own retry).
  function handleAdminRequestsLoaded(data) {
    setAdminOpenCount(data.filter((r) => !CLOSED_STATUSES.includes(r.status)).length)
  }

  return (
    <div className="app-shell">
      {/* G411-108: Fixed 56px app bar — ☰ (menu, stays visible on every
          screen; the dialog's own close button handles closing it, since
          showModal()'s top-layer means an app-bar button can't be seen or
          clicked while it's open) — back chevron (sub-screens only, one
          consistent app-bar-level control, left of the wordmark) —
          wordmark (center) — avatar chip (right). */}
      <div className="app-bar">
        {isSignedIn && (
          <Button
            variant="icon"
            onClick={() => setHamburgerOpen(true)}
            aria-label="Menu"
            aria-expanded={hamburgerOpen}
            aria-controls="app-menu"
          >
            <Icon name="menu" />
            {unreadCount > 0 && <span className="hamburger-unread-dot" aria-hidden="true" />}
          </Button>
        )}

        {/* Back chevron — one consistent app-bar-level back control for
            every sub-screen, left of the wordmark. Mirrors each screen's
            own onBack prop exactly (see the setView calls passed as
            onBack below) rather than introducing separate logic. */}
        {isSignedIn && view !== 'list' && (
          <Button
            variant="icon"
            onClick={() => {
              if (view === 'profile') {
                profilePageRef.current?.handleBack()
              } else {
                setView(view === 'detail' || view === 'admin-create-request' ? previousView : 'list')
              }
            }}
            aria-label="Back"
          >
            <Icon name="back" />
          </Button>
        )}

        {/* Center slot: wordmark with same navigation logic as before, plus
            a presence dot grouped right next to it (G411-109 — moved off
            FriendHome's own header so that slot is free for the future
            credits ring, G411-113). Wrapped together so the pair centers
            as one unit regardless of which wordmark variant renders below
            — a dot placed as a plain flex sibling would center-anchor to
            the wordmark's own flex:1 box and land at the far edge of the
            bar instead of beside the text. `title` gives hover-to-reveal
            status text natively, no tooltip JS needed. Dot shown for
            every signed-in user, admin and friend alike, same as the old
            inline chip this replaces. */}
        <span className="wordmark-with-presence">
          {view === 'new' ? (
            <button
              type="button"
              className="wordmark wordmark-app-bar wordmark-button"
              onClick={() => {
                if (newRequestHasText) {
                  setShowLogoDiscardConfirm(true);
                  return;
                }
                setView('list');
              }}
            >
              Gavi411
            </button>
          ) : view === 'list' ? (
            <h1 className="wordmark wordmark-app-bar">Gavi411</h1>
          ) : (
            <button type="button" className="wordmark wordmark-app-bar wordmark-button" onClick={() => setView('list')}>
              Gavi411
            </button>
          )}
          {isSignedIn && (
            <span
              className={`app-bar-presence-dot ${isOnline ? 'online' : 'offline'}`}
              role="status"
              title={isOnline ? 'Gavi411 available' : 'Gavi411 offline — replies may wait'}
              aria-label={isOnline ? 'Gavi411 available' : 'Gavi411 offline — replies may wait'}
            />
          )}
        </span>

        {/* Right slot: avatar chip button, plus a same-width invisible
            spacer whenever the back chevron shows on the left — keeps
            the wordmark's flex:1 centering balanced 2-vs-2 instead of
            shifting right against an unmatched 3rd left-side icon. */}
        {isSignedIn && view !== 'list' && <span className="app-bar-chevron-spacer" aria-hidden="true" />}
        {isSignedIn && (
          <Button
            variant="icon"
            onClick={() => setView('profile')}
            className="avatar-chip"
            title={fetchedUser?.username || user?.primaryEmailAddress?.emailAddress || user?.id}
          >
            {fetchedUser?.profilePic ? (
              <img
                src={fetchedUser.profilePic}
                alt=""
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span className="avatar-initials">
                {(fetchedUser?.username || user?.primaryEmailAddress?.emailAddress || user?.id)?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </Button>
        )}
      </div>
      {escrowBackupFailed && (
        <p role="alert" className="escrow-backup-warning">
          Your account was created, but we couldn't set up message encryption for this device —
          your messages may not be end-to-end encrypted, and if you lose this device you may not
          be able to recover them. Contact Gavi if this keeps happening.{' '}
          <button type="button" onClick={() => setEscrowBackupFailed(false)}>Dismiss</button>
        </p>
      )}
      {permalinkError && (
        <p role="alert" className="escrow-backup-warning">
          That link doesn't lead anywhere — it may be wrong, or for a request you don't have access to.{' '}
          <button type="button" onClick={() => setPermalinkError(false)}>Dismiss</button>
        </p>
      )}
      <ClerkLoading>Loading…</ClerkLoading>
      <ClerkLoaded>
        {/* G411-89: keep list component mounted at all times once role
            resolves, hidden instead of unmounted on view change. Prevents
            list-data loss (in-flight fetches discarded) and state loss
            (sort/filter/group/search UI in AdminList) when navigating away
            and back. Rendered here as a sibling of the main view-switch
            below (not inside it), shown/hidden via the hidden attribute.
            Sibling review finding: this originally sat as a sibling of
            <ClerkLoaded> itself, gated only by role !== null — role can in
            practice only be non-null after Clerk has finished loading (it's
            set from an /api/me fetch that itself waits on isSignedIn), so
            it wasn't an active bug, but it was correct by coincidence, not
            by construction. Moved inside <ClerkLoaded> so the guarantee is
            structural, matching how every other view already behaves. */}
        {role !== null && (
          <div hidden={view !== 'list' || pendingPermalink}>
            {isAdmin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 560 }}>
                <Button variant="primary" onClick={() => { setPreviousView('list'); setView('admin-create-request') }}>
                  + New request
                </Button>
                {adminOpenCount === null ? (
                  <Button disabled>Loading…</Button>
                ) : (
                  <Button onClick={() => { setPreviousView('list'); setView('open-requests'); }}>
                    {adminOpenCount} open requests
                  </Button>
                )}
                <Button onClick={() => { setPreviousView('list'); setView('invite-admin') }}>
                  Invite
                </Button>
                <div>
                  <Button
                    onClick={async () => {
                      setPresenceToggling(true)
                      setPresenceToggleError(false)
                      try {
                        const res = await fetch('/api/presence', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ isOnline: !isOnline }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          setIsOnline(data.isOnline)
                        } else {
                          setPresenceToggleError(true)
                        }
                      } catch {
                        setPresenceToggleError(true)
                      } finally {
                        setPresenceToggling(false)
                      }
                    }}
                    disabled={presenceToggling}
                  >
                    {presenceToggling ? '…' : isOnline ? 'Go offline' : 'Go online'}
                  </Button>
                  {presenceToggleError && (
                    <p style={{ fontSize: 13, color: 'var(--text)', marginTop: 'var(--space-1)' }}>
                      Failed to update — try again.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // Friend's own "+ New request" removed (G411-109) — FriendHome's
              // composer bar ("What's up?") replaces it below.
              null
            )}
          </div>
        )}
        {/* Admin's Open/Closed requests screen — kept mounted (hidden,
            not unmounted) across navigation, same reasoning and same
            pattern as the 'list' view div right above (G411-89): a
            fresh AdminList per ternary branch (the original G411-95
            shape) meant React saw the same component type reused
            across branches and DIDN'T remount it on its own, so
            switching Open<->Closed silently kept whatever filter/data
            had first loaded (Gavi, live testing) — forcing a remount
            via `key` fixed that but threw the fetch away every switch.
            A single persistent instance with `filter` as a real
            controlled prop (not initialFilter, read-once) avoids both:
            correct on every switch, no refetch needed since the data
            doesn't change, only which subset is shown. */}
        {role !== null && isAdmin && (
          <div hidden={view !== 'open-requests' && view !== 'closed-requests'}>
            <AdminList
              filter={view === 'closed-requests' ? 'closed' : 'open'}
              onRequestsLoaded={handleAdminRequestsLoaded}
              refreshToken={roleRetryToken + pushRefreshToken}
              onOpenRequest={(id) => {
                setSelectedRequestId(id)
                setPreviousView(view)
                setView('detail')
              }}
            />
          </div>
        )}
        {isSignedIn && !tokenHandoffDone ? (
          <p>Loading…</p>
        ) : isSignedIn && pendingPermalink ? (
          <p>Loading…</p>
        ) : isSignedIn && unauthorized ? (
          <p>You do not have permission to use Gavi411.</p>
        ) : isSignedIn && recovery.token ? (
          <Recover
            token={recovery.token}
            passphrase={recovery.passphrase}
            onDone={() => {
              clearStashedRecoveryParams()
              setRecovery({ token: null, passphrase: null })
            }}
          />
        ) : isSignedIn && needsProfileCompletion && !isAdmin ? (
          // Sibling review finding: an admin promoted via
          // scripts/promote-admin.js only gets role flipped, never
          // phoneNumber — a freshly-promoted admin whose phone is still
          // 'pending-<clerkId>' would otherwise be stuck behind this
          // friend-facing gate with zero admin UI reachable. Consistent
          // with decision #111 (admin never routes through friend-only
          // self-service flows) — role and needsProfileCompletion both
          // resolve from the same /api/me fetch, so isAdmin is reliable
          // here, not a race.
          <CompleteProfile
            currentProfilePic={userProfilePic}
            onComplete={() => {
              setNeedsProfileCompletion(false)
              setRoleRetryToken((t) => t + 1)
            }}
          />
        ) : isSignedIn ? (
          view === 'new' ? (
            <NewRequest
              isOnline={isOnline}
              onDone={(requestId) => { setNewRequestHasText(false); setRoleRetryToken((t) => t + 1); if (requestId) { openRequest(requestId); } else { setView('list'); } }}
              onExit={() => { setNewRequestHasText(false); setView('list'); }}
              onFreeTextChange={(v) => setNewRequestHasText(!!v)}
            />
          ) : view === 'install-help' ? (
            <InstallHelp />
          ) : view === 'invite-admin' ? (
            <InviteAdmin onBack={() => setView('list')} />
          ) : view === 'trigger-admin' ? (
            <TriggerAdmin onBack={() => setView('list')} />
          ) : view === 'admin-create-request' ? (
            <AdminCreateRequest onBack={() => setView(previousView)} />
          ) : view === 'user-management' ? (
            <UserManagement />
          ) : view === 'notification-history' ? (
            <NotificationHistory onOpenRequest={openRequest} onCleared={() => setUnreadCount(0)} />
          ) : view === 'profile' ? (
            <ProfilePage
              ref={profilePageRef}
              user={fetchedUser}
              onBack={() => setView('list')}
              onUpdated={(updatedUser) => {
                // Update locally cached user fields
                setFetchedUser(updatedUser)
                setUserProfilePic(updatedUser?.profilePic ?? null)
              }}
            />
          ) : view === 'detail' ? (
            <RequestDetail requestId={selectedRequestId} isAdmin={isAdmin} />
          ) : view === 'open-requests' ? (
            // Admin renders via the persistent hidden AdminList div
            // above instead (real reason in that div's comment) — this
            // branch only needs to fire for friends now.
            isAdmin ? null : (
              <FriendRequestsList
                status="open"
                refreshToken={roleRetryToken + pushRefreshToken}
                onOpenRequest={(id) => { setSelectedRequestId(id); setPreviousView('open-requests'); setView('detail'); }}
              />
            )
          ) : view === 'closed-requests' ? (
            isAdmin ? null : (
              <FriendRequestsList
                status="closed"
                refreshToken={roleRetryToken + pushRefreshToken}
                onOpenRequest={(id) => { setSelectedRequestId(id); setPreviousView('closed-requests'); setView('detail'); }}
              />
            )
          ) : roleFetchFailed ? (
            // Sibling review finding: the /api/me fetch failing (network
            // blip, cold-start timeout) used to leave role permanently
            // null with no visible error and no way out — a real retry
            // path instead of a silent dead end.
            <div>
              <p>Couldn't load your account. Try again?</p>
              <Button onClick={() => setRoleRetryToken((t) => t + 1)}>Try again</Button>
            </div>
          ) : role === null ? (
            // Sibling review finding: rendering RequestList/AdminList based
            // on a still-null `role` used to briefly mount RequestList
            // (isAdmin=false) for an admin, then unmount/remount it as
            // AdminList the instant role resolved — a visible flash that
            // also discarded RequestList's in-flight fetch. Waiting for
            // role to actually resolve avoids ever mounting the wrong one.
            <p>Loading…</p>
          ) : view === 'list' ? (
            !isAdmin && <FriendHome refreshToken={roleRetryToken + pushRefreshToken} onOpenRequest={(id) => { setSelectedRequestId(id); setPreviousView('list'); setView('detail'); }} onCompose={() => setView('new')} />
          ) : (
            // Fallback for any unmapped view state (shouldn't occur, but
            // preserves existing behavior for safety)
            null
          )
        ) : inviteTokenState === 'checking' ? (
          <p>Loading…</p>
        ) : (
          inviteTokenState === 'valid' ? <SignUp /> : <SignIn />
        )}
      </ClerkLoaded>
      {/* G411-95: hamburger menu navigation. Contents depend on user role
          (friend vs admin) and include navigation items + theme toggle. */}
      <HamburgerMenu
        open={hamburgerOpen}
        onClose={() => {
          setHamburgerOpen(false)
          fetch('/api/notifications/unread-count')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) setUnreadCount(data.count)
            })
            .catch(() => {})
        }}
      >
        {isSignedIn && (
          <>
            {/* Group "You" */}
            {/* Profile is reachable via the app-bar avatar chip (G411-108) —
                not duplicated here as a menu item. */}
            {/* Notification history — visible to everyone (friend and admin) */}
            <button
              type="button"
              className="hamburger-menu-item"
              onClick={() => {
                setView('notification-history')
                setHamburgerOpen(false)
              }}
            >
              <Icon name="bell" size={20} />
              Notifications
            </button>

            {/* Group "Requests" — admin-only now that friends' Open/Closed
                links live on FriendHome instead (G411-109); divider would
                otherwise leave an empty gap between it and "Setup" for
                friends specifically (admin's own render is unaffected,
                its four items still populate this group). */}
            {isAdmin && <div className="hamburger-menu-divider" />}

            {/* Triggers — admin-only, right after Profile per spec (Gavi's
                call: Presence/Invites moved to the admin home screen
                instead, only Triggers stays in the menu). */}
            {isAdmin && (
              <button
                type="button"
                className="hamburger-menu-item"
                onClick={() => {
                  setView('trigger-admin')
                  setHamburgerOpen(false)
                }}
              >
                Triggers
              </button>
            )}

            {/* User Management — admin-only user management screen (G411-99) */}
            {isAdmin && (
              <button
                type="button"
                className="hamburger-menu-item"
                onClick={() => {
                  setView('user-management')
                  setHamburgerOpen(false)
                }}
              >
                User Management
              </button>
            )}

            {/* Open requests — routes to AdminList for admin, FriendRequestsList
                for friends (branches on isAdmin at render time below, not
                here — both roles navigate the same way). */}
            {isAdmin && (
              <button
                type="button"
                className="hamburger-menu-item"
                onClick={() => {
                  setPreviousView('list')
                  setView('open-requests')
                  setHamburgerOpen(false)
                }}
              >
                Open requests
              </button>
            )}

            {/* Closed requests — same split as above, AdminList vs
                FriendRequestsList decided at render time. */}
            {isAdmin && (
              <button
                type="button"
                className="hamburger-menu-item"
                onClick={() => {
                  setPreviousView('list')
                  setView('closed-requests')
                  setHamburgerOpen(false)
                }}
              >
                Closed requests
              </button>
            )}

            {/* Group "Setup" */}
            <div className="hamburger-menu-divider" />

            {/* Installing on iPhone — was RequestList's own link before
                G411-95 removed RequestList from the friend home screen;
                moved here so it stays reachable rather than becoming
                dead routing. Friend-only, matching its original home in
                RequestList (friend-facing PWA-install help doesn't apply
                to admin — Gavi's live catch). */}
            {!isAdmin && (
              <button
                type="button"
                className="hamburger-menu-item"
                onClick={() => {
                  setView('install-help')
                  setHamburgerOpen(false)
                }}
              >
                Installing on iPhone
              </button>
            )}

            {/* Enable notifications — G411-49. Shown to everyone if push is
                supported. Disabled if notifications are denied in browser
                settings. States: denied (can't fix from JS) / unsubscribed
                (clickable "Enable") / subscribed (clickable "Disable"). */}

            <PushNotificationToggle
              isSignedIn={isSignedIn}
              onClose={() => setHamburgerOpen(false)}
              onShowDeniedHelp={() => setShowPushDeniedHelp(true)}
            />

            {/* Theme toggle — shown to everyone */}
            <button
              type="button"
              className="hamburger-menu-theme-toggle"
              onClick={cycleTheme}
            >
              Theme: {THEME_LABEL[theme]}
            </button>
          </>
        )}
      </HamburgerMenu>
      <ConfirmModal
        open={showLogoDiscardConfirm}
        message="Discard this request?"
        onConfirm={() => {
          setShowLogoDiscardConfirm(false);
          setNewRequestHasText(false);
          setView('list');
        }}
        onCancel={() => setShowLogoDiscardConfirm(false)}
      />
      <DeniedHelpDialog
        open={showPushDeniedHelp}
        onClose={() => setShowPushDeniedHelp(false)}
      />
    </div>
  )
}

export default App
