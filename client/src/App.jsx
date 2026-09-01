import { useState, useEffect } from 'react'
import { useUser, useClerk, SignIn, SignUp, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'
import RequestList from './pages/RequestList'
import RequestDetail from './pages/RequestDetail'
import InstallHelp from './pages/InstallHelp'
import InviteAdmin from './pages/InviteAdmin'
import ConfirmModal from './components/ConfirmModal'
import { useTheme } from './useTheme'
import Recover from './pages/Recover'
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

// G411-41: stash any ?token= before Clerk's own redirect flow can touch
// the URL — see client/src/lib/inviteToken.js for why sessionStorage,
// not the URL param itself, carries the token through an OAuth round trip.
captureInviteTokenFromUrl()
// G411-28 stage 4: same reasoning, same moment, for a ?recover= link —
// Sibling review finding, a lost/new device opening a recovery link is
// just as likely to be signed OUT (hitting the same OAuth hazard) as a
// brand-new signup is.
captureRecoveryParamsFromUrl()

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
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const [view, setView] = useState('list') // 'list' | 'new' | 'install-help' | 'detail' | 'invite-admin'
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [newRequestHasText, setNewRequestHasText] = useState(false)
  const [showLogoDiscardConfirm, setShowLogoDiscardConfirm] = useState(false)
  const { theme, cycleTheme } = useTheme()

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
  const [unauthorized, setUnauthorized] = useState(false)
  // G411-28 stage 4: a ?recover=<token>#<passphrase> link, stashed by
  // captureRecoveryParamsFromUrl() above the same way the signup token
  // is — read once here, doesn't need to react to later URL changes.
  const [recovery, setRecovery] = useState(getStashedRecoveryParams)
  useEffect(() => {
    if (!isSignedIn || !tokenHandoffDone) return
    fetch('/api/me')
      .then((res) => {
        if (res.status === 403) {
          setUnauthorized(true)
          return null
        }
        return res.json()
      })
      .then((data) => data && setRole(data.user?.role ?? null))
      .catch(() => {})
  }, [isSignedIn, tokenHandoffDone])

  // Matan's Sibling review, PR #35, Fix 1a: self-healing sweep, admin
  // side. Only admin's browser ever holds the private key needed to wrap
  // a conversation key for a linked device, so this can't run until
  // `role` resolves to ADMIN — a regular friend's browser has nothing to
  // contribute here (they only ever consume already-wrapped keys, via
  // loadLinkedConversationKeys above). Best-effort, silently no-ops on
  // any failure — see wrapMissingConversationKeys's own doc comment.
  useEffect(() => {
    if (role !== 'ADMIN') return
    loadPrivateKey().then((key) => {
      if (key) wrapMissingConversationKeys(key)
    })
  }, [role])

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
        {/* Minimal account indicator + sign-out, until a real account
            menu exists — Gavi's call: keep this, don't strip it, once a
            nicer version is built it replaces this rather than removing
            it outright. */}
        {isSignedIn && (
          <span className="account-indicator">
            {user?.primaryEmailAddress?.emailAddress || user?.id}{' '}
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
      <ClerkLoading>Loading…</ClerkLoading>
      <ClerkLoaded>
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
          ) : view === 'detail' ? (
            <RequestDetail requestId={selectedRequestId} onBack={() => setView('list')} isAdmin={role === 'ADMIN'} />
          ) : (
            <RequestList
              onNewRequest={() => setView('new')}
              onShowInstallHelp={() => setView('install-help')}
              onOpenRequest={(id) => { setSelectedRequestId(id); setView('detail'); }}
              isAdmin={role === 'ADMIN'}
            />
          )
        ) : inviteTokenState === 'checking' ? (
          <p>Loading…</p>
        ) : (
          inviteTokenState === 'valid' ? <SignUp /> : <SignIn />
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
