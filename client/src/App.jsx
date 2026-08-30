import { useState, useEffect } from 'react'
import { useUser, SignIn, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'
import RequestList from './pages/RequestList'
import RequestDetail from './pages/RequestDetail'
import InstallHelp from './pages/InstallHelp'
import InviteAdmin from './pages/InviteAdmin'
import ConfirmModal from './components/ConfirmModal'
import { useTheme } from './useTheme'
import {
  captureInviteTokenFromUrl,
  getStashedInviteToken,
  clearStashedInviteToken,
} from './lib/inviteToken'

// G411-41: stash any ?token= before Clerk's own redirect flow can touch
// the URL — see client/src/lib/inviteToken.js for why sessionStorage,
// not the URL param itself, carries the token through an OAuth round trip.
captureInviteTokenFromUrl()

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' }

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
  const { isSignedIn } = useUser()
  const [view, setView] = useState('list') // 'list' | 'new' | 'install-help' | 'detail' | 'invite-admin'
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [newRequestHasText, setNewRequestHasText] = useState(false)
  const [showLogoDiscardConfirm, setShowLogoDiscardConfirm] = useState(false)
  const { theme, cycleTheme } = useTheme()

  // G411-41: role isn't on the Clerk user object (it's our own Prisma
  // field) — fetch it once via the existing /api/me smoke-test route
  // (G411-13) rather than adding a new endpoint just for this.
  const [role, setRole] = useState(null)
  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => setRole(data.user?.role ?? null))
      .catch(() => {})
  }, [isSignedIn])

  // G411-41: signed-out visitors need a valid stashed invite token before
  // Clerk sign-in is reachable at all — a returning signed-in user skips
  // this check entirely (their Clerk session alone proves prior legitimate
  // access; they may have no stashed token left, having used it once).
  // 'checking' | 'valid' | 'invalid'
  const [inviteState, setInviteState] = useState('checking')

  useEffect(() => {
    if (isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) {
      setInviteState('invalid')
      return
    }
    fetch(`/api/invites/${encodeURIComponent(token)}/valid`)
      .then((res) => res.json())
      .then((data) => setInviteState(data.valid ? 'valid' : 'invalid'))
      .catch(() => setInviteState('invalid'))
  }, [isSignedIn])

  // Once actually signed in, send the stashed token (if any) once so the
  // server can mark it used and link it to the new User row (server/
  // middleware/auth.js). No-op for a returning user with nothing stashed.
  useEffect(() => {
    if (!isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) return
    fetch('/api/requests', { headers: { 'x-invite-token': token } }).finally(() => {
      clearStashedInviteToken()
    })
  }, [isSignedIn])

  return (
    <div className="design-preview">
      <div className="header-row">
        {/* Clickable everywhere there's somewhere to go back to (Gavi's
            ask — logo should always be an exit control, not just from
            install-help). On the intake flow, still routes through the
            same confirm-if-typed prompt NewRequest's own "×" uses, so an
            accidental logo tap can't silently discard a typed request. */}
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
        {/* G411-73: cycles system -> light -> dark -> system. Text label
            (not just an icon) so the current state is unambiguous without
            needing a tooltip. */}
        <button type="button" className="theme-toggle" onClick={cycleTheme}>
          Theme: {THEME_LABEL[theme]}
        </button>
        {/* G411-41: only entry point to the invite-creation UI — shown to
            admins only, minimal placement per the ticket's own note not
            to wait on the full admin cockpit (G411-37/38). */}
        {role === 'ADMIN' && (
          <button type="button" onClick={() => setView('invite-admin')}>
            Invites
          </button>
        )}
      </div>
      <ClerkLoading>Loading…</ClerkLoading>
      <ClerkLoaded>
        {isSignedIn ? (
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
          ) : view === 'detail' ? (
            <RequestDetail requestId={selectedRequestId} onBack={() => setView('list')} />
          ) : (
            <RequestList
              onNewRequest={() => setView('new')}
              onShowInstallHelp={() => setView('install-help')}
              onOpenRequest={(id) => { setSelectedRequestId(id); setView('detail'); }}
            />
          )
        ) : inviteState === 'checking' ? (
          <p>Loading…</p>
        ) : inviteState === 'valid' ? (
          <SignIn />
        ) : (
          // No public signup (PRD §2 non-goals) — a visitor without a
          // valid invite link never reaches Clerk sign-in at all.
          <p>This app is invite-only. Ask Gavi for an invite link.</p>
        )}
      </ClerkLoaded>
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
    </div>
  )
}

export default App
