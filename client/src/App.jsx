import { useState, useEffect } from 'react'
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
import { useTheme } from './useTheme'
import Recover from './pages/Recover'
import FriendRequestsList from './pages/FriendRequestsList'
import { CLOSED_STATUSES } from './pages/RequestList'
import {
  captureInviteTokenFromUrl,
  getStashedInviteToken,
  clearStashedInviteToken,
  getStashedInvitePassphrase,
  clearStashedInvitePassphrase,
  captureRecoveryParamsFromUrl,
  getStashedRecoveryParams,
  clearStashedRecoveryParams,
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

const THEME_LABEL = { light: 'Light', dark: 'Dark' }

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
  const [view, setView] = useState('list') // 'list' | 'new' | 'install-help' | 'detail' | 'invite-admin' | 'trigger-admin' | 'admin-create-request' | 'profile' | 'user-management' | 'notification-history' | 'open-requests' | 'closed-requests'
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [newRequestHasText, setNewRequestHasText] = useState(false)
  const [showLogoDiscardConfirm, setShowLogoDiscardConfirm] = useState(false)
  // G411-49 fix: DeniedHelpDialog must render as a top-level sibling, not
  // nested inside HamburgerMenu — see PushNotificationToggle.jsx's comment.
  const [showPushDeniedHelp, setShowPushDeniedHelp] = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [previousView, setPreviousView] = useState('list')
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
    <div className="design-preview">
      {/* G411-95: hamburger-menu navigation redesign. Header now shows:
          hamburger icon (left) - logo (center) - account indicator (right) */}
      <div className="header-row">
        {isSignedIn && (
          <button
            type="button"
            className="hamburger-button"
            onClick={() => setHamburgerOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
        )}
        {/* Logo always clickable to exit views back to list/home screen,
            with same confirm-if-typed logic on the new-request intake. */}
        {view === 'new' ? (
          <button
            type="button"
            className="wordmark wordmark-button"
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
          <h1 className="wordmark">Gavi411</h1>
        ) : (
          <button type="button" className="wordmark wordmark-button" onClick={() => setView('list')}>
            Gavi411
          </button>
        )}
        {/* Account indicator stays in right corner, unchanged from original */}
        {isSignedIn && (
          <span className="account-indicator">
            <button
              type="button"
              className="account-indicator-trigger"
              onClick={() => setView('profile')}
            >
              {fetchedUser?.username || user?.primaryEmailAddress?.emailAddress || user?.id}
            </button>
            {' '}
            <button type="button" onClick={() => signOut()}>Sign out</button>
          </span>
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
      {/* G411-43: presence status banner for all signed-in users — shows
          whether Gavi is currently available to respond. */}
      {isSignedIn && !isOnline && (
        <p role="status" className="presence-offline-notice">
          Offline — replies may be delayed
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
          <div hidden={view !== 'list'}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 420 }}>
                <Button variant="primary" onClick={() => setView('new')}>
                  + New request
                </Button>
              </div>
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
              onDone={() => { setNewRequestHasText(false); setView('list'); }}
              onExit={() => { setNewRequestHasText(false); setView('list'); }}
              onFreeTextChange={(v) => setNewRequestHasText(!!v)}
            />
          ) : view === 'install-help' ? (
            <InstallHelp onBack={() => setView('list')} />
          ) : view === 'invite-admin' ? (
            <InviteAdmin onBack={() => setView('list')} />
          ) : view === 'trigger-admin' ? (
            <TriggerAdmin onBack={() => setView('list')} />
          ) : view === 'admin-create-request' ? (
            <AdminCreateRequest onBack={() => setView(previousView)} />
          ) : view === 'user-management' ? (
            <UserManagement onBack={() => setView('list')} />
          ) : view === 'notification-history' ? (
            <NotificationHistory onBack={() => setView('list')} />
          ) : view === 'profile' ? (
            <ProfilePage
              user={fetchedUser}
              onBack={() => setView('list')}
              onUpdated={(updatedUser) => {
                // Update locally cached user fields
                setFetchedUser(updatedUser)
                setUserProfilePic(updatedUser?.profilePic ?? null)
              }}
            />
          ) : view === 'detail' ? (
            <RequestDetail requestId={selectedRequestId} onBack={() => setView(previousView)} isAdmin={isAdmin} />
          ) : view === 'open-requests' ? (
            // Admin renders via the persistent hidden AdminList div
            // above instead (real reason in that div's comment) — this
            // branch only needs to fire for friends now.
            isAdmin ? null : (
              <FriendRequestsList
                status="open"
                onOpenRequest={(id) => { setSelectedRequestId(id); setPreviousView('open-requests'); setView('detail'); }}
              />
            )
          ) : view === 'closed-requests' ? (
            isAdmin ? null : (
              <FriendRequestsList
                status="closed"
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
            null
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
        onClose={() => setHamburgerOpen(false)}
      >
        {isSignedIn && (
          <>
            {/* Profile */}
            <button
              type="button"
              className="hamburger-menu-item"
              onClick={() => {
                setView('profile')
                setHamburgerOpen(false)
              }}
            >
              Profile
            </button>

            {/* Notification history — visible to everyone (friend and admin) */}
            <button
              type="button"
              className="hamburger-menu-item"
              onClick={() => {
                setView('notification-history')
                setHamburgerOpen(false)
              }}
            >
              Notifications
            </button>

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

            {/* Closed requests — same split as above, AdminList vs
                FriendRequestsList decided at render time. */}
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
            <div className="hamburger-menu-divider" />
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
