import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'

// G411-13: ClerkProvider makes auth state/hooks (useUser, useAuth,
// SignIn, ClerkLoaded/ClerkLoading, etc.) available anywhere in the tree.
// Correction (G411-66): @clerk/react has no SignedIn/SignedOut components —
// gate on useUser().isSignedIn instead (see App.jsx). Needs
// VITE_CLERK_PUBLISHABLE_KEY in client/.env.local (see client/.env.example)
// — Vite only exposes env vars prefixed VITE_ to browser code.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — see client/.env.example')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)

// G411-15: register the service worker (client/public/sw.js) so the app
// meets the installability bar (manifest + registered SW). Guarded by a
// feature check since older/non-standard browsers don't have
// navigator.serviceWorker at all. Runs after the initial render so it
// never blocks first paint.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
