import { prisma } from './prisma.js'

// Shared credit-mutation helpers. Both take a Prisma transaction client for composability.

// Monthly allotment tiered by group tag. One-time initial grant at signup.
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

// Tier change: upgrade adds full delta; downgrade only clamps if above new cap.
export function creditDeltaForTierChange(oldGroupTag, newGroupTag, currentBalance) {
  const oldCap = initialCreditFor(oldGroupTag)
  const newCap = initialCreditFor(newGroupTag)

  if (newCap >= oldCap) {
    return newCap - oldCap
  }
  return Math.min(0, newCap - currentBalance)
}

// Monthly credit reset job. Runs every 6 hours; fire-and-log pattern (one failure doesn't block others).
export async function resetMonthlyCredits() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: {
      clerkId: true,
      groupTag: true,
      creditBalance: true,
      creditsResetAt: true,
      overdraftUsedAt: true,
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

        let shouldClearOverdraftUsedAt = false
        if (user.overdraftUsedAt) {
          // Check if overdraftUsedAt is in a different month than today
          const overdraftMonth = user.overdraftUsedAt.getMonth()
          const overdraftYear = user.overdraftUsedAt.getFullYear()
          shouldClearOverdraftUsedAt = overdraftMonth !== currentMonth || overdraftYear !== currentYear
        }

        const updateData = {
          creditBalance: newBalance,
          creditsResetAt: new Date(),
        }
        if (shouldClearOverdraftUsedAt) {
          updateData.overdraftUsedAt = null
        }

        await tx.user.update({
          where: { clerkId: user.clerkId },
          data: updateData,
        })

        if (delta !== 0) {
          await tx.creditTransaction.create({
            data: { amount: delta, userId: user.clerkId },
          })
        }
      })
    } catch (err) {
      // Log the failure but continue processing the next user.
      console.error(`Failed to reset credits for user ${user.clerkId}:`, err)
    }
  }
}
