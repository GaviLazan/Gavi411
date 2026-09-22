// Invite token and recovery link handling: stash in sessionStorage to survive Clerk's OAuth round trip.
// Token sent via x-invite-token header, passphrase used client-side for escrow wrapping.

const STORAGE_KEY = 'gavi411-invite-token'
const PASSPHRASE_STORAGE_KEY = 'gavi411-invite-passphrase'
const RECOVER_TOKEN_STORAGE_KEY = 'gavi411-recover-token'
const RECOVER_PASSPHRASE_STORAGE_KEY = 'gavi411-recover-passphrase'
const PERMALINK_STORAGE_KEY = 'gavi411-request-permalink'

// Strips both the query string and the fragment from the visible URL —
// shared by both capture functions below so neither the invite token/
// passphrase nor the recovery token/passphrase lingers in browser
// history or gets accidentally shared via copy-paste of the address bar.
function clearUrl(paramsToKeep) {
  const rest = paramsToKeep.toString()
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
}

// Called once on app load. If the URL carries ?token=..., stash it (and
// any #passphrase fragment) and strip the whole URL.
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
  clearUrl(params)
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

// Called once on app load, same moment as captureInviteTokenFromUrl — if
// the URL carries ?recover=..., stash it (and any #passphrase fragment)
// and strip the whole URL, same reasoning as the signup token: a
// recovery link is opened on a device that has no session yet just as
// often as the original invite link is, so it needs to survive the same
// OAuth round trip rather than being read live off a URL Clerk may have
// already rewritten by the time the app re-renders signed-in.
export function captureRecoveryParamsFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('recover')
  if (!token) return

  sessionStorage.setItem(RECOVER_TOKEN_STORAGE_KEY, token)
  const passphrase = window.location.hash.slice(1)
  if (passphrase) sessionStorage.setItem(RECOVER_PASSPHRASE_STORAGE_KEY, passphrase)

  params.delete('recover')
  clearUrl(params)
}

export function getStashedRecoveryParams() {
  return {
    token: sessionStorage.getItem(RECOVER_TOKEN_STORAGE_KEY),
    passphrase: sessionStorage.getItem(RECOVER_PASSPHRASE_STORAGE_KEY),
  }
}

// Called once recovery has finished (success or a definitive failure the
// user has seen) so a stale recovery link doesn't keep re-triggering.
export function clearStashedRecoveryParams() {
  sessionStorage.removeItem(RECOVER_TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(RECOVER_PASSPHRASE_STORAGE_KEY)
}

// Regex to match request permalink URLs: /r/<publicId>
// publicId is base64url (alphanumeric + - _), case-sensitive
const PERMALINK_PATTERN = /^\/r\/([A-Za-z0-9_-]+)$/

// Pure function to extract publicId from a pathname, returns null if no match
export function extractPublicIdFromPath(pathname) {
  const match = pathname.match(PERMALINK_PATTERN)
  return match ? match[1] : null
}

// Called once on app load. If the URL path is /r/<publicId>, stash the
// publicId in sessionStorage so it survives Clerk's OAuth round trip.
// Unlike invite tokens, do NOT clear the URL — the permalink URL stays
// visible in the address bar (deliberate design decision).
export function captureRequestPermalinkFromUrl() {
  const publicId = extractPublicIdFromPath(window.location.pathname)
  if (!publicId) return

  sessionStorage.setItem(PERMALINK_STORAGE_KEY, publicId)
}

export function getStashedRequestPermalink() {
  return sessionStorage.getItem(PERMALINK_STORAGE_KEY)
}

// Called once the permalink has been resolved and the request detail
// view is open, so it isn't re-fetched on every later render.
export function clearStashedRequestPermalink() {
  sessionStorage.removeItem(PERMALINK_STORAGE_KEY)
}

// Gate for permalink consumption: excludes incomplete profile except admin (admin exempted from profile screen).
export function canConsumeRequestPermalink({
  isSignedIn,
  tokenHandoffDone,
  role,
  isAdmin,
  needsProfileCompletion,
  recoveryToken,
}) {
  return Boolean(
    isSignedIn &&
      tokenHandoffDone &&
      role !== null &&
      (!needsProfileCompletion || isAdmin) &&
      !recoveryToken
  )
}
