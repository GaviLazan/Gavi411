// Tests for requireAuth (G411-76). Mocks @clerk/express and Prisma — no
// real Clerk/DB call made. Covers the real bug this ticket fixed: new
// users get real name/email from Clerk's API (not blank JWT claims), and
// an existing user's data isn't clobbered on repeat requests.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuth = vi.fn()
const mockGetUser = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdateManyInvite = vi.fn()

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: (req) => mockGetAuth(req),
  clerkClient: { users: { getUser: (id) => mockGetUser(id) } },
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: (...args) => mockFindUnique(...args),
      create: (...args) => mockCreate(...args),
    },
    pendingInvite: {
      updateMany: (...args) => mockUpdateManyInvite(...args),
    },
  },
}))

const { requireAuth } = await import('./auth.js')

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth', () => {
  it('401s with no Clerk session', async () => {
    mockGetAuth.mockReturnValue({ userId: null })
    const res = mockRes()
    const next = vi.fn()

    await requireAuth({}, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('creates a new user with real Clerk name/email, not blank claims', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockResolvedValue({
      firstName: 'Gavi',
      lastName: 'Lazan',
      primaryEmailAddressId: 'idn_1',
      emailAddresses: [{ id: 'idn_1', emailAddress: 'gavriel.lazan@gmail.com' }],
    })
    mockCreate.mockResolvedValue({ clerkId: 'user_new', firstName: 'Gavi' })
    const req = {}
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clerkId: 'user_new',
        firstName: 'Gavi',
        lastName: 'Lazan',
        email: 'gavriel.lazan@gmail.com',
        phoneNumber: 'pending-user_new',
      }),
    })
    expect(req.user).toEqual({ clerkId: 'user_new', firstName: 'Gavi' })
    expect(next).toHaveBeenCalled()
  })

  it('picks the primary email, not just array index 0', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_multi_email' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockResolvedValue({
      firstName: 'A',
      lastName: 'B',
      primaryEmailAddressId: 'idn_2',
      emailAddresses: [
        { id: 'idn_1', emailAddress: 'secondary@example.com' },
        { id: 'idn_2', emailAddress: 'primary@example.com' },
      ],
    })
    mockCreate.mockResolvedValue({})

    await requireAuth({}, mockRes(), vi.fn())

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'primary@example.com' }),
    })
  })

  it('503s cleanly if Clerk\'s API fails, instead of throwing unhandled', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockRejectedValue(new Error('Clerk API down'))
    const res = mockRes()
    const next = vi.fn()

    await requireAuth({}, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('recovers from a concurrent-create race instead of throwing', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_racing' })
    mockFindUnique
      .mockResolvedValueOnce(null) // first findUnique: not found yet
      .mockResolvedValueOnce({ clerkId: 'user_racing', firstName: 'Winner' }) // re-fetch after race
    mockGetUser.mockResolvedValue({ firstName: 'Racer', lastName: '', emailAddresses: [] })
    const raceError = new Error('Unique constraint failed')
    raceError.code = 'P2002'
    mockCreate.mockRejectedValue(raceError)
    const req = {}
    const next = vi.fn()

    await requireAuth(req, mockRes(), next)

    expect(req.user).toEqual({ clerkId: 'user_racing', firstName: 'Winner' })
    expect(next).toHaveBeenCalled()
  })

  it('does not re-create or re-fetch Clerk for an existing user', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_existing' })
    mockFindUnique.mockResolvedValue({ clerkId: 'user_existing', firstName: 'Already Synced' })
    const req = {}
    const next = vi.fn()

    await requireAuth(req, mockRes(), next)

    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(req.user).toEqual({ clerkId: 'user_existing', firstName: 'Already Synced' })
    expect(next).toHaveBeenCalled()
  })

  it('falls back to null email when Clerk user has none', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_no_email' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockResolvedValue({ firstName: '', lastName: '', emailAddresses: [] })
    mockCreate.mockResolvedValue({})

    await requireAuth({}, mockRes(), vi.fn())

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: null, firstName: '', lastName: '' }),
    })
  })

  // G411-41
  it('marks an invite token used when x-invite-token header is present on a new user', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockResolvedValue({ firstName: 'A', lastName: 'B', emailAddresses: [] })
    mockCreate.mockResolvedValue({ clerkId: 'user_new' })
    const req = { headers: { 'x-invite-token': 'tok123' } }

    await requireAuth(req, mockRes(), vi.fn())

    expect(mockUpdateManyInvite).toHaveBeenCalledWith({
      where: { token: 'tok123', usedAt: null },
      data: expect.objectContaining({ usedByUserId: 'user_new' }),
    })
  })

  it('does not touch invites when no x-invite-token header is sent', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockGetUser.mockResolvedValue({ firstName: 'A', lastName: 'B', emailAddresses: [] })
    mockCreate.mockResolvedValue({ clerkId: 'user_new' })

    await requireAuth({}, mockRes(), vi.fn())

    expect(mockUpdateManyInvite).not.toHaveBeenCalled()
  })

  it('does not mark an invite for an existing (already-synced) user, even with the header', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_existing' })
    mockFindUnique.mockResolvedValue({ clerkId: 'user_existing' })
    const req = { headers: { 'x-invite-token': 'tok123' } }

    await requireAuth(req, mockRes(), vi.fn())

    expect(mockUpdateManyInvite).not.toHaveBeenCalled()
  })
})
