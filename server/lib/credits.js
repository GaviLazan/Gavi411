// Shared credit-mutation helpers (G411-45/48). Extracted from G411-23's
// original inline transaction block in requests.js's POST / — same
// transaction-safety property (balance re-read fresh inside the caller's
// tx, not a stale req.user snapshot), now reusable by any caller that
// needs to deduct or refund atomically alongside its own writes.
//
// Both functions take `tx` (a Prisma transaction client, e.g. from
// prisma.$transaction(async (tx) => ...)) rather than opening their own
// transaction — callers compose them with other writes (e.g. G411-31's
// status update + refund) inside one atomic block.

// PRD §9: monthly allotment tiered by group tag. Not enforced as a monthly
// reset here (G411-46) — this is only the one-time initial grant at
// signup.
const INITIAL_CREDITS = {
  LIMITED: 2,
  REGULAR: 5,
  CLOSE: 7,
}

export function initialCreditFor(groupTag) {
  return INITIAL_CREDITS[groupTag] ?? INITIAL_CREDITS.REGULAR
}

// Deducts 1 credit from userId, rejecting if the balance is already below
// 1. Throws an Error with .statusCode = 402 on insufficient balance, same
// shape POST / already relied on.
export async function deductCredit(tx, userId) {
  const user = await tx.user.findUnique({
    where: { clerkId: userId },
    select: { creditBalance: true },
  })

  if (user.creditBalance < 1) {
    const err = new Error('Insufficient credit balance')
    err.statusCode = 402
    throw err
  }

  await tx.user.update({
    where: { clerkId: userId },
    data: { creditBalance: { decrement: 1 } },
  })

  await tx.creditTransaction.create({
    data: { amount: -1, userId },
  })
}

// Refunds 1 credit to userId. No balance floor check — refunding can only
// raise a balance, never triggers the insufficient-balance path.
export async function refundCredit(tx, userId) {
  await tx.user.update({
    where: { clerkId: userId },
    data: { creditBalance: { increment: 1 } },
  })

  await tx.creditTransaction.create({
    data: { amount: 1, userId },
  })
}
