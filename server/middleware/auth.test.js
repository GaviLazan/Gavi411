// Tests for requireAuth (G411-76). Mocks @clerk/express and Prisma — no
// real Clerk/DB call made. Covers the real bug this ticket fixed: new
// users get real name/email from Clerk's API (not blank JWT claims), and
// an existing user's data isn't clobbered on repeat requests.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuth = vi.fn()
const mockGetUser = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()

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
      emailAddresses: [{ emailAddress: 'gavriel.lazan@gmail.com' }],
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
})
