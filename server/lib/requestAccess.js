// Shared owner-or-admin access check for a Request (G411-82 Sibling
// review finding) — server/routes/requests.js re-implemented the same
// `X.userId !== req.user.clerkId && req.user.role !== 'ADMIN'` check
// independently at 4 separate call sites; a future change to the rule
// (e.g. a per-admin "assigned" model instead of "any admin") would need
// to be found and updated in all 4 by hand. Same pattern as
// server/lib/invites.js's shared claim helper.

// True if `user` may access `request` — either they own it, or they're
// an admin. `request` only needs its `userId` field.
export function canAccessRequest(request, user) {
  return request.userId === user.clerkId || user.role === 'ADMIN'
}
