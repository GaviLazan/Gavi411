import { useUser, SignIn, ClerkLoaded, ClerkLoading } from '@clerk/react'
import './App.css'
import NewRequest from './pages/NewRequest'

// G411-66: gate real content behind Clerk auth state.
// NOTE: this project's installed package is "@clerk/react" (a lower-level
// package), not "@clerk/clerk-react" — it does not export SignedIn/SignedOut
// components. Same auth-state gating, done with the useUser hook instead
// (native to the already-installed package, no new dependency).
// Signed-out visitors get Clerk's hosted SignIn component instead of the
// intake form.
function App() {
  const { isSignedIn } = useUser()

  return (
    <div className="design-preview">
      <h1 className="wordmark">Gavi411</h1>
      <ClerkLoading>Loading…</ClerkLoading>
      <ClerkLoaded>
        {isSignedIn ? <NewRequest /> : <SignIn />}
      </ClerkLoaded>
    </div>
  )
}

export default App
