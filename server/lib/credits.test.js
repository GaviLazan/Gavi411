// Tests for the shared credit helper (G411-45/48). No real DB — a fake
// `tx` object stands in for a Prisma transaction client.

import { describe, it, expect, vi } from 'vitest'
import { deductCredit, refundCredit, initialCreditFor } from './credits.js'

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
