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

// "The" admin account — same lookup GET /:id/public-keys and GET /my-keys
// (devices.js) each used to hand-roll independently before this extraction
// (Sibling review finding, G411-35/36). Ordered by createdAt so the choice
// is deterministic if a second admin account ever exists (today there's
// exactly one — G411-76 is single-admin — so this is unreachable in
// practice, same reasoning as those two call sites).
export async function getAdminUser(db) {
  return db.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })
}

// True if any ADMIN-role user has sent a Message on this request — G411-31's
// "untouched" refund-eligibility check, pulled out to its own named export
// since G411-32/33 (urgent downgrade, close-confirm flow) will likely need
// the same "has an admin touched this request" fact. Takes a Prisma client
// (or transaction client `tx`) so callers can run it inside their own
// transaction.
export async function hasAdminMessaged(db, requestId) {
  const adminMessage = await db.message.findFirst({
    where: { requestId, user: { role: 'ADMIN' } },
  })
  return adminMessage !== null
}
