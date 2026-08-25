import { useState } from 'react'
import { useUser, SignIn, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'
import RequestList from './pages/RequestList'
import RequestDetail from './pages/RequestDetail'
import InstallHelp from './pages/InstallHelp'
import ConfirmModal from './components/ConfirmModal'
import { useTheme } from './useTheme'

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
  const [view, setView] = useState('list') // 'list' | 'new' | 'install-help' | 'detail'
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [newRequestHasText, setNewRequestHasText] = useState(false)
  const [showLogoDiscardConfirm, setShowLogoDiscardConfirm] = useState(false)
  const { theme, cycleTheme } = useTheme()

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
          ) : view === 'detail' ? (
            <RequestDetail requestId={selectedRequestId} onBack={() => setView('list')} />
          ) : (
            <RequestList
              onNewRequest={() => setView('new')}
              onShowInstallHelp={() => setView('install-help')}
              onOpenRequest={(id) => { setSelectedRequestId(id); setView('detail'); }}
            />
          )
        ) : (
          <SignIn />
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
