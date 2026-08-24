import { useState } from 'react'
import { useUser, SignIn, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'
import RequestList from './pages/RequestList'
import InstallHelp from './pages/InstallHelp'
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
  const [view, setView] = useState('list') // 'list' | 'new' | 'install-help'
  const { theme, cycleTheme } = useTheme()

  return (
    <div className="design-preview">
      <h1 className="wordmark">Gavi411</h1>
      {/* G411-73: cycles system -> light -> dark -> system. Text label
          (not just an icon) so the current state is unambiguous without
          needing a tooltip. */}
      <button type="button" className="theme-toggle" onClick={cycleTheme}>
        Theme: {THEME_LABEL[theme]}
      </button>
      <ClerkLoading>Loading…</ClerkLoading>
      <ClerkLoaded>
        {isSignedIn ? (
          view === 'new' ? (
            <NewRequest onDone={() => setView('list')} />
          ) : view === 'install-help' ? (
            <InstallHelp onBack={() => setView('list')} />
          ) : (
            <RequestList
              onNewRequest={() => setView('new')}
              onShowInstallHelp={() => setView('install-help')}
            />
          )
        ) : (
          <SignIn />
        )}
      </ClerkLoaded>
    </div>
  )
}

export default App
