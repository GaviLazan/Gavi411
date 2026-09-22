import { useState, useEffect, useRef } from 'react'
import { useClerk, SignIn, SignUp, ClerkLoaded, ClerkLoading } from '@clerk/react'
import { useSession } from './useSession'
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
import CreditRing from './components/CreditRing'
import { useTheme } from './useTheme'
import Recover from './pages/Recover'
import FriendRequestsList from './pages/FriendRequestsList'
import FriendHome from './pages/FriendHome'
import { CLOSED_STATUSES } from './lib/requestStatus'
import {
  captureInviteTokenFromUrl,
  captureRecoveryParamsFromUrl,
  clearStashedRecoveryParams,
  captureRequestPermalinkFromUrl,
  getStashedRequestPermalink,
  clearStashedRequestPermalink,
  canConsumeRequestPermalink,
} from './lib/inviteToken'
import PushNotificationToggle, { DeniedHelpDialog } from './components/PushNotificationToggle'

// Stash any ?token= before Clerk's own redirect flow can touch the URL —
// see client/src/lib/inviteToken.js for why sessionStorage, not the URL
// param itself, carries the token through an OAuth round trip.
captureInviteTokenFromUrl()
// Same reasoning for a ?recover= link — a lost/new device opening one is
// just as likely to be signed out as a brand-new signup is.
captureRecoveryParamsFromUrl()
// Capture /r/<publicId> permalink URLs for later consumption after
// sign-in completes (unlike invite tokens, the URL stays visible).
captureRequestPermalinkFromUrl()

const THEME_LABEL = { light: 'Light', dark: 'Dark' }

// Mirrors server/lib/credits.js's INITIAL_CREDITS — a small client-side
// copy rather than a shared package for a 3-entry constant map.
const CREDIT_CAP_BY_TIER = { LIMITED: 2, REGULAR: 5, CLOSE: 7 }

const VIEW_STORAGE_KEY = 'gavi411_view_state'

// This project's installed package is "@clerk/react" (a lower-level
// package), not "@clerk/clerk-react" — it has no SignedIn/SignedOut
// components, so auth-state gating uses useUser directly instead.
//
// View switching is plain useState, not a router — few enough screens
// that a router dependency isn't justified at this size.
function App() {
  const {
    isSignedIn,
    user,
    inviteTokenState,
    tokenHandoffDone,
    escrowBackupFailed,
    dismissEscrowBackupFailed,
    role,
    isAdmin,
    needsProfileCompletion,
    clearNeedsProfileCompletion,
    userProfilePic,
    fetchedUser,
    setFetchedUser,
    setUserProfilePic,
    showsCreditRing,
    unauthorized,
    roleFetchFailed,
    roleRetryToken,
    retryRole,
    recovery,
    clearRecovery,
  } = useSession()
  const { signOut } = useClerk()
  // Restore view state from sessionStorage on mount, but only if no
  // permalink is being consumed (permalink flow takes precedence).
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
  // DeniedHelpDialog must render as a top-level sibling, not nested inside
  // HamburgerMenu — see PushNotificationToggle.jsx's comment.
  const [showPushDeniedHelp, setShowPushDeniedHelp] = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  // Lets the app-bar back button trigger ProfilePage's real exit logic
  // (Clerk sync, when needed — see ProfilePage's handleBack) instead of a
  // plain setView when view === 'profile'.
  const profilePageRef = useRef(null)
  const [unreadCount, setUnreadCount] = useState(0)
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
  const [presenceToggleError, setPresenceToggleError] = useState(false)
  const [adminOpenCount, setAdminOpenCount] = useState(null)

  // Every signed-in user should see whether Gavi is online.
  useEffect(() => {
    fetch('/api/presence')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setIsOnline(data.isOnline))
      .catch(() => {}) // silently default to true on network error
  }, [])

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
  // AdminList stays mounted-hidden across nav rather than remounting, so
  // switching back to Open/Closed requests doesn't refetch on its own —
  // bump on becoming visible, not on every internal filter/sort change.
  useEffect(() => {
    if (view === 'open-requests' || view === 'closed-requests') {
      setPushRefreshToken((t) => t + 1)
    }
  }, [view])

  // Unread-notification dot on the hamburger icon — reuses pushRefreshToken
  // rather than a separate timer poll.
  useEffect(() => {
    if (!isSignedIn || !tokenHandoffDone) return
    fetch('/api/notifications/unread-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUnreadCount(data.count)
      })
      .catch(() => {})
  }, [isSignedIn, tokenHandoffDone, pushRefreshToken])

  useEffect(() => {
    sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      view,
      selectedRequestId,
      previousView,
    }))
  }, [view, selectedRequestId, previousView])

  // Named so both the permalink-consume effect and notification handlers
  // below can reuse it without duplication.
  function openRequest(requestId) {
    setSelectedRequestId(requestId)
    setPreviousView('list')
    setView('detail')
  }

  // Notification clicks from the service worker deep-link into a request.
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

  // Tells the user rather than silently dropping them on the home screen
  // when a permalink 404s (unknown id, or a request they can't access).
  const [permalinkError, setPermalinkError] = useState(false)
  // True whenever a permalink is stashed and unresolved — suppresses the
  // home screen's real content so it doesn't flash before the redirect.
  const [pendingPermalink, setPendingPermalink] = useState(() => Boolean(getStashedRequestPermalink()))

  // Consumes a stashed request permalink URL once auth gates clear — admin
  // is exempt from the profile-completion check (admin's phoneNumber is
  // permanently the pending- placeholder by design, so a plain
  // needsProfileCompletion check would leave this stuck forever for admin).
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

  // Admin's open request count, derived from AdminList's own already-
  // fetched data rather than a second independent /api/requests fetch.
  function handleAdminRequestsLoaded(data) {
    setAdminOpenCount(data.filter((r) => !CLOSED_STATUSES.includes(r.status)).length)
  }

  return (
    <div className="app-shell">
      {/* Fixed 56px app bar — ☰ (menu) — back chevron (sub-screens only) —
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

        {/* Left-side spacer, same size as the back chevron — the wordmark's
            flex:1 only centers when both sides have equal fixed width, and
            the credit ring makes the right side 2 icons wide on the list
            view, which has no chevron to balance it. */}
        {isSignedIn && view === 'list' && showsCreditRing && (
          <span className="app-bar-chevron-spacer" aria-hidden="true" />
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

        {/* Center slot: wordmark + presence dot, wrapped together so the
            pair centers as one unit — a dot placed as a plain flex sibling
            would center-anchor to the wordmark's own flex:1 box instead. */}
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

        {/* Right slot: credit ring (friends only) + avatar chip. Left is 1
            icon (hamburger) or 2 (+ back chevron); right is 1 (avatar) or
            2 (+ ring, friends with a balance). This spacer covers the case
            where chevron shows but ring doesn't — right is short by one
            icon. The other unbalanced case (list view + ring, left short)
            has its own spacer above, in the left slot. */}
        {isSignedIn && view !== 'list' && !showsCreditRing && (
          <span className="app-bar-chevron-spacer" aria-hidden="true" />
        )}
        {showsCreditRing && (
          <CreditRing
            balance={fetchedUser.creditBalance}
            cap={CREDIT_CAP_BY_TIER[fetchedUser.groupTag] ?? CREDIT_CAP_BY_TIER.REGULAR}
          />
        )}
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
          <button type="button" onClick={dismissEscrowBackupFailed}>Dismiss</button>
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
        {/* Keep the list component mounted at all times once role resolves,
            hidden instead of unmounted on view change, to prevent list-data
            and filter/sort state loss when navigating away and back. */}
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
              // FriendHome's composer bar replaces this for friends.
              null
            )}
          </div>
        )}
        {/* Admin's Open/Closed requests screen — kept mounted (hidden, not
            unmounted) across navigation, same reasoning as the 'list' view
            div above. A single persistent instance with `filter` as a real
            controlled prop keeps it correct on every switch with no
            refetch, since only which subset is shown changes. */}
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
              clearRecovery()
            }}
          />
        ) : isSignedIn && needsProfileCompletion && !isAdmin ? (
          // !isAdmin: an admin promoted via scripts/promote-admin.js only
          // gets role flipped, never phoneNumber, so a freshly-promoted
          // admin would otherwise be stuck behind this friend-only gate.
          <CompleteProfile
            currentProfilePic={userProfilePic}
            onComplete={() => {
              clearNeedsProfileCompletion()
              retryRole()
            }}
          />
        ) : isSignedIn ? (
          view === 'new' ? (
            <NewRequest
              isOnline={isOnline}
              onDone={(requestId) => { setNewRequestHasText(false); retryRole(); if (requestId) { openRequest(requestId); } else { setView('list'); } }}
              onExit={() => { setNewRequestHasText(false); setView('list'); }}
              onFreeTextChange={(v) => setNewRequestHasText(!!v)}
            />
          ) : view === 'install-help' ? (
            <InstallHelp />
          ) : view === 'invite-admin' ? (
            <InviteAdmin />
          ) : view === 'trigger-admin' ? (
            <TriggerAdmin />
          ) : view === 'admin-create-request' ? (
            <AdminCreateRequest />
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
            <div>
              <p>Couldn't load your account. Try again?</p>
              <Button onClick={() => retryRole()}>Try again</Button>
            </div>
          ) : role === null ? (
            // Wait for role to resolve rather than briefly mounting the
            // wrong list (RequestList for what turns out to be an admin,
            // for instance) and then swapping it — avoids a visible flash.
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
      {/* Hamburger menu navigation. Contents depend on user role
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
            {/* Profile is reachable via the app-bar avatar chip, not
                duplicated here as a menu item. */}
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
                links live on FriendHome instead; divider would otherwise
                leave an empty gap for friends specifically. */}
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

            {/* User Management — admin-only user management screen */}
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

            {/* Installing on iPhone — friend-only, PWA-install help doesn't
                apply to admin. */}
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

            {/* Shown to everyone if push is supported. States: denied
                (can't fix from JS) / unsubscribed / subscribed. */}

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
