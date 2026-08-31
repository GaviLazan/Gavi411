// Invite token client-side handling (G411-41; escrow passphrase + recovery
// link added G411-28 stage 4). A plain `?token=` URL param — or a
// `#`-fragment passphrase — can't be relied on to survive Clerk's OAuth
// redirect round trip (Google sign-in bounces through Google and back) —
// so both are stashed in sessionStorage the moment the page loads with
// them, read back after sign-in completes. The token is sent once via the
// x-invite-token header (see server/middleware/auth.js) to get marked
// used; the passphrase is used once, client-side only, to wrap the new
// escrow keypair before it's uploaded (never sent to the server itself —
// see server/routes/invites.js's PATCH /:token/backup).
//
// Sibling review finding: recovery links (?recover=<token>#<passphrase>)
// were originally read straight from the live URL on the (wrong)
// assumption that recovery only happens once already signed in — but a
// lost/new device is very likely signed OUT, so it hits the exact same
// Clerk-redirect hazard as signup and needs the same sessionStorage stash,
// done here below. Also: the fragment was never actually stripped from
// the visible URL on either path, despite this file's own original claim
// that it was — both paths now strip the whole URL (search + hash) via
// one shared helper.

const STORAGE_KEY = 'gavi411-invite-token'
const PASSPHRASE_STORAGE_KEY = 'gavi411-invite-passphrase'
const RECOVER_TOKEN_STORAGE_KEY = 'gavi411-recover-token'
const RECOVER_PASSPHRASE_STORAGE_KEY = 'gavi411-recover-passphrase'

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
