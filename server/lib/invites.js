// Shared invite-validity/claim logic (G411-81 Sibling review finding) —
// single source of truth, used by both server/middleware/auth.js (the
// real signup gate) and server/routes/invites.js (the pre-signin no-auth
// check). Previously each re-implemented its own notion of "valid",
// which could drift out of sync on a future rule change (e.g. expiry).

import { prisma } from './prisma.js'

// Two-phase claim, split across claimInvite() and linkClaimedInvite()
// below — NOT one write, because `usedByUserId` is a foreign key to
// User.clerkId (prisma/schema.prisma), and this claim has to run BEFORE
// the User row exists (to close the TOCTOU race this file fixes — see
// requireAuth). Setting usedByUserId in the same write that establishes
// exclusivity would violate that FK for a genuinely new signup (hit
// live: PrismaClientKnownRequestError, PendingInvite_usedByUserId_fkey).
//
// Phase 1 (this function): atomically claim the token using ONLY
// `usedAt` as the exclusivity gate (no FK on that column) — the WHERE
// clause IS the validity check, so two different users racing the same
// token can't both succeed. Returns true if THIS call won the claim.
//
// Only one real request per signup should ever reach this (the client
// aborts React StrictMode's duplicate effect invocation before its
// fetch completes — see client/src/App.jsx) — but if a duplicate ever
// does land here anyway (a real retry, not StrictMode), the caller
// (requireAuth) treats a failed claim + an already-existing User row as
// "this was already handled," not a hard rejection.
export async function claimInvite(token) {
  if (!token) return false
  const result = await prisma.pendingInvite.updateMany({
    where: { token, usedAt: null },
    data: { usedAt: new Date() },
  })
  return result.count === 1
}

// Phase 2: once the User row actually exists, link the invite to it for
// bookkeeping/display (InviteAdmin's "used by" list) — safe to call any
// time after a successful claimInvite() for the same token, including
// more than once (e.g. StrictMode's duplicate request), since it only
// ever sets usedByUserId when it's still null.
export async function linkClaimedInvite(token, userId) {
  if (!token) return
  await prisma.pendingInvite.updateMany({
    where: { token, usedByUserId: null },
    data: { usedByUserId: userId },
  })
}

// Un-claims a token (releases the usedAt gate) — used when claimInvite()
// succeeded but account creation failed afterward (Clerk API down, etc.),
// so a genuinely valid invite isn't permanently burned by an unrelated
// failure. Only un-claims if it was never actually linked to a user yet.
export async function unclaimInvite(token) {
  if (!token) return
  await prisma.pendingInvite.updateMany({
    where: { token, usedByUserId: null },
    data: { usedAt: null },
  })
}

export async function isInviteValid(token) {
  if (!token) return false
  const invite = await prisma.pendingInvite.findUnique({ where: { token } })
  return Boolean(invite && !invite.usedAt)
}
