// Invite token client-side handling (G411-41; escrow passphrase added
// G411-28 stage 4). A plain `?token=` URL param — or a `#`-fragment
// passphrase — can't be relied on to survive Clerk's OAuth redirect round
// trip (Google sign-in bounces through Google and back) — so both are
// stashed in sessionStorage the moment the page loads with them, read
// back after sign-in completes. The token is sent once via the
// x-invite-token header (see server/middleware/auth.js) to get marked
// used; the passphrase is used once, client-side only, to wrap the new
// escrow keypair before it's uploaded (never sent to the server itself —
// see server/routes/invites.js's PATCH /:token/backup).

const STORAGE_KEY = 'gavi411-invite-token'
const PASSPHRASE_STORAGE_KEY = 'gavi411-invite-passphrase'

// Called once on app load. If the URL carries ?token=..., stash it (and
// any #passphrase fragment) and strip both from the visible URL (avoids
// them lingering in browser history or being accidentally shared via
// copy-paste of the address bar).
export function captureInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) return

  sessionStorage.setItem(STORAGE_KEY, token)
  // location.hash includes the leading '#' — strip it. The fragment is
  // optional (an invite created before escrow existed, or a re-visited
  // link that already had its fragment stripped, has none) — that's not
  // an error, it just means no escrow backup gets uploaded for this signup.
  const passphrase = window.location.hash.slice(1)
  if (passphrase) sessionStorage.setItem(PASSPHRASE_STORAGE_KEY, passphrase)

  params.delete('token')
  const rest = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
}

export function getStashedInviteToken() {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function getStashedInvitePassphrase() {
  return sessionStorage.getItem(PASSPHRASE_STORAGE_KEY)
}

// Called once the token has been sent to the server (first authenticated
// request after signup) so it isn't resent on every later request.
export function clearStashedInviteToken() {
  sessionStorage.removeItem(STORAGE_KEY)
}

// Called once the escrow backup has been uploaded (or definitively skipped
// — no passphrase was ever stashed) so it isn't retried every render.
export function clearStashedInvitePassphrase() {
  sessionStorage.removeItem(PASSPHRASE_STORAGE_KEY)
}

// Reads a ?recover=<token>#<passphrase> link (G411-28 stage 4). Unlike the
// signup token above, this doesn't need to survive an OAuth round trip —
// recovery only makes sense for someone already signed in (see
// pages/Recover.jsx) — so it's read directly from the live URL, no
// sessionStorage stash needed. Returns null/null if this isn't a recovery
// link.
export function getRecoveryParamsFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('recover')
  if (!token) return { token: null, passphrase: null }
  return { token, passphrase: window.location.hash.slice(1) || null }
}
