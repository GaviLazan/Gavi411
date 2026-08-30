// Invite token client-side handling (G411-41). A plain `?token=` URL
// param can't be relied on to survive Clerk's OAuth redirect round trip
// (Google sign-in bounces through Google and back) — so the token is
// stashed in sessionStorage the moment the page loads with it, read back
// after sign-in completes, and sent once via the x-invite-token header
// (see server/middleware/auth.js) to get marked used.

const STORAGE_KEY = 'gavi411-invite-token'

// Called once on app load. If the URL carries ?token=..., stash it and
// strip it from the visible URL (avoids it lingering in browser history
// or being accidentally shared via copy-paste of the address bar).
export function captureInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) return

  sessionStorage.setItem(STORAGE_KEY, token)
  params.delete('token')
  const rest = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
}

export function getStashedInviteToken() {
  return sessionStorage.getItem(STORAGE_KEY)
}

// Called once the token has been sent to the server (first authenticated
// request after signup) so it isn't resent on every later request.
export function clearStashedInviteToken() {
  sessionStorage.removeItem(STORAGE_KEY)
}
