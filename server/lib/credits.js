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

// G411-46: monthly credit reset job. Resets credit balance to the tier's
// initial amount for any user whose creditsResetAt is either null (never
// reset) or falls in a different calendar month than today. Calendar month
// is determined by getMonth()/getFullYear() (or their UTC equivalents — we
// match the codebase's existing convention), so a user who joined near
// month-end and gets reset again just days later on the next month-change
// is expected behavior, not a bug.
//
// Runs every 6 hours via server.js's setInterval — no need for finer-
// grained polling. Fire-and-log: a failure for one user does not stop
// the pass from processing others. Non-atomic across users by design:
// if the server crashes after resetting user #3, user #4 onward will
// simply retry on the next pass without duplicating #3's transaction.
export async function resetMonthlyCredits() {
  const users = await prisma.user.findMany({
    select: {
      clerkId: true,
      groupTag: true,
      creditBalance: true,
      creditsResetAt: true,
    },
  })

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  for (const user of users) {
    try {
      // Determine if this user needs a reset: either creditsResetAt is
      // null, or it's from a different calendar month.
      let needsReset = !user.creditsResetAt
      if (user.creditsResetAt && !needsReset) {
        const lastResetMonth = user.creditsResetAt.getMonth()
        const lastResetYear = user.creditsResetAt.getFullYear()
        needsReset = lastResetMonth !== currentMonth || lastResetYear !== currentYear
      }

      if (!needsReset) {
        continue
      }

      // Perform the reset in a transaction: update balance + creditsResetAt,
      // and write the transaction log entry with the delta amount.
      await prisma.$transaction(async (tx) => {
        const newBalance = initialCreditFor(user.groupTag)
        const delta = newBalance - user.creditBalance

        await tx.user.update({
          where: { clerkId: user.clerkId },
          data: {
            creditBalance: newBalance,
            creditsResetAt: new Date(),
          },
        })

        await tx.creditTransaction.create({
          data: { amount: delta, userId: user.clerkId },
        })
      })
    } catch (err) {
      // Log the failure but continue processing the next user.
      console.error(`Failed to reset credits for user ${user.clerkId}:`, err)
    }
  }
}
