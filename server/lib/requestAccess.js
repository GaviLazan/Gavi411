// Shared owner-or-admin access check for a Request.

// True if `user` may access `request` — either they own it, or they're
// an admin. `request` only needs its `userId` field.
export function canAccessRequest(request, user) {
  return request.userId === user.clerkId || user.role === 'ADMIN'
}

// "The" admin account, ordered by createdAt for deterministic selection.
export async function getAdminUser(db) {
  return db.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })
}

// True if any ADMIN has sent a real (non-system) Message on this request.
// Excludes system messages (isSystem: true) — those are automated nudges, not real replies.
export async function hasAdminMessaged(db, requestId) {
  const adminMessage = await db.message.findFirst({
    where: { requestId, user: { role: 'ADMIN' }, isSystem: false },
  })
  return adminMessage !== null
}
