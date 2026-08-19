import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'

// G411-13: ClerkProvider makes auth state/hooks (useUser, useAuth,
// SignedIn/SignedOut, etc.) available anywhere in the tree. Needs
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
