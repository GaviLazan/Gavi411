// Tests for the shared credit helper (G411-45/48) and monthly reset job
// (G411-46). No real DB — a fake `tx` object stands in for a Prisma
// transaction client.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deductCredit, refundCredit, initialCreditFor, resetMonthlyCredits } from './credits.js'

function fakeTx(creditBalance) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ creditBalance }),
      update: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
  }
}

describe('initialCreditFor', () => {
  it('tiers by group tag per PRD §9', () => {
    expect(initialCreditFor('LIMITED')).toBe(2)
    expect(initialCreditFor('REGULAR')).toBe(5)
    expect(initialCreditFor('CLOSE')).toBe(7)
  })

  it('falls back to REGULAR for an unknown/missing tag', () => {
    expect(initialCreditFor(undefined)).toBe(5)
    expect(initialCreditFor('NOT_A_TAG')).toBe(5)
  })
})

describe('deductCredit', () => {
  it('decrements balance and writes a -1 CreditTransaction', async () => {
    const tx = fakeTx(3)
    await deductCredit(tx, 'user_1')

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_1' },
      data: { creditBalance: { decrement: 1 } },
    })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: -1, userId: 'user_1' },
    })
  })

  it('rejects with a 402 error when balance is already below 1', async () => {
    const tx = fakeTx(0)

    await expect(deductCredit(tx, 'user_1')).rejects.toMatchObject({
      statusCode: 402,
    })
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })
})

describe('refundCredit', () => {
  it('increments balance and writes a +1 CreditTransaction', async () => {
    const tx = fakeTx(0)
    await refundCredit(tx, 'user_1')

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_1' },
      data: { creditBalance: { increment: 1 } },
    })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 1, userId: 'user_1' },
    })
  })
})

describe('resetMonthlyCredits', () => {
  let prismaMock

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      creditTransaction: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    }
    vi.stubGlobal('prisma', prismaMock)
  })

  it('resets a user with null creditsResetAt', async () => {
    const now = new Date()
    const user = {
      clerkId: 'user_reset_null',
      groupTag: 'REGULAR',
      creditBalance: 2,
      creditsResetAt: null,
    }
    prismaMock.user.findMany.mockResolvedValue([user])

    await resetMonthlyCredits()

    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_reset_null' },
      data: {
        creditBalance: 5, // REGULAR tier
        creditsResetAt: expect.any(Date),
      },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 3, userId: 'user_reset_null' }, // 5 - 2 = 3
    })
  })

  it('resets a user when creditsResetAt is in a different month', async () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const user = {
      clerkId: 'user_reset_month',
      groupTag: 'CLOSE',
      creditBalance: 5,
      creditsResetAt: lastMonth,
    }
    prismaMock.user.findMany.mockResolvedValue([user])

    await resetMonthlyCredits()

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'user_reset_month' },
      data: {
        creditBalance: 7, // CLOSE tier
        creditsResetAt: expect.any(Date),
      },
    })
    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 2, userId: 'user_reset_month' }, // 7 - 5 = 2
    })
  })

  it('does NOT reset a user when creditsResetAt is in the current month', async () => {
    const now = new Date()
    const samMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const user = {
      clerkId: 'user_no_reset',
      groupTag: 'LIMITED',
      creditBalance: 1,
      creditsResetAt: samMonth,
    }
    prismaMock.user.findMany.mockResolvedValue([user])

    await resetMonthlyCredits()

    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('writes a CreditTransaction even when the delta is 0', async () => {
    const user = {
      clerkId: 'user_zero_delta',
      groupTag: 'REGULAR',
      creditBalance: 5, // exactly REGULAR tier amount
      creditsResetAt: null,
    }
    prismaMock.user.findMany.mockResolvedValue([user])

    await resetMonthlyCredits()

    expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
      data: { amount: 0, userId: 'user_zero_delta' },
    })
  })

  it('continues processing other users if one fails', async () => {
    const users = [
      { clerkId: 'user_1', groupTag: 'REGULAR', creditBalance: 0, creditsResetAt: null },
      { clerkId: 'user_2', groupTag: 'REGULAR', creditBalance: 0, creditsResetAt: null },
      { clerkId: 'user_3', groupTag: 'REGULAR', creditBalance: 0, creditsResetAt: null },
    ]
    prismaMock.user.findMany.mockResolvedValue(users)
    let callCount = 0
    // Make user_2's transaction throw (on the 2nd call)
    prismaMock.$transaction.mockImplementation((cb) => {
      callCount++
      if (callCount === 2) {
        throw new Error('DB error for user_2')
      }
      return cb(prismaMock)
    })

    await resetMonthlyCredits()

    // user_1 and user_3 should still be processed despite user_2's failure
    // At least 2 successful transactions should have run
    expect(prismaMock.$transaction.mock.calls.length).toBe(3)
    expect(callCount).toBe(3) // All 3 users attempted
  })
})
