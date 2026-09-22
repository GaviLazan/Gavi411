// Shared invite-validity/claim logic — single source of truth for signup and pre-signin checks.

import { prisma } from './prisma.js'

// Phase 1: atomically claim the token using `usedAt` as the exclusivity gate.
// Returns true if this call won the claim. Split from linkClaimedInvite() because
// usedByUserId is an FK to User.clerkId, which doesn't exist yet at claim time.
export async function claimInvite(token) {
  if (!token) return false
  const result = await prisma.pendingInvite.updateMany({
    where: { token, usedAt: null },
    data: { usedAt: new Date() },
  })
  return result.count === 1
}

// Phase 2: link the claimed invite to the user once their User row exists.
export async function linkClaimedInvite(token, userId) {
  if (!token) return
  await prisma.pendingInvite.updateMany({
    where: { token, usedByUserId: null },
    data: { usedByUserId: userId },
  })
}

// Un-claims a token: releases usedAt if account creation failed after claim.
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
