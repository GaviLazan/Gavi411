// Tests for requireAuth (G411-76). Mocks @clerk/express and Prisma — no
// real Clerk/DB call made. Covers the real bug this ticket fixed: new
// users get real name/email from Clerk's API (not blank JWT claims), and
// an existing user's data isn't clobbered on repeat requests.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuth = vi.fn()
const mockGetUser = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockClaimInvite = vi.fn()
const mockLinkClaimedInvite = vi.fn()
const mockUnclaimInvite = vi.fn()

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

vi.mock('../lib/invites.js', () => ({
  claimInvite: (...args) => mockClaimInvite(...args),
  linkClaimedInvite: (...args) => mockLinkClaimedInvite(...args),
  unclaimInvite: (...args) => mockUnclaimInvite(...args),
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
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockResolvedValue({
      firstName: 'Gavi',
      lastName: 'Lazan',
      primaryEmailAddressId: 'idn_1',
      emailAddresses: [{ id: 'idn_1', emailAddress: 'gavriel.lazan@gmail.com' }],
    })
    mockCreate.mockResolvedValue({ clerkId: 'user_new', firstName: 'Gavi' })
    const req = { headers: { 'x-invite-token': 'tok123' } }
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
    mockClaimInvite.mockResolvedValue(true)
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

    await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), vi.fn())

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'primary@example.com' }),
    })
  })

  it('503s cleanly if Clerk\'s API fails, instead of throwing unhandled', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockRejectedValue(new Error('Clerk API down'))
    const res = mockRes()
    const next = vi.fn()

    await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('un-claims the invite if Clerk\'s API fails after the claim already succeeded (Sibling review finding)', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockRejectedValue(new Error('Clerk API down'))

    await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), vi.fn())

    expect(mockUnclaimInvite).toHaveBeenCalledWith('tok123')
  })

  it('recovers from a concurrent-create race instead of throwing', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_racing' })
    mockFindUnique
      .mockResolvedValueOnce(null) // first findUnique: not found yet
      .mockResolvedValueOnce({ clerkId: 'user_racing', firstName: 'Winner' }) // re-fetch after race
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockResolvedValue({ firstName: 'Racer', lastName: '', emailAddresses: [] })
    const raceError = new Error('Unique constraint failed')
    raceError.code = 'P2002'
    mockCreate.mockRejectedValue(raceError)
    const req = { headers: { 'x-invite-token': 'tok123' } }
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
    expect(mockClaimInvite).not.toHaveBeenCalled()
    expect(req.user).toEqual({ clerkId: 'user_existing', firstName: 'Already Synced' })
    expect(next).toHaveBeenCalled()
  })

  it('falls back to null email when Clerk user has none', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_no_email' })
    mockFindUnique.mockResolvedValue(null)
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockResolvedValue({ firstName: '', lastName: '', emailAddresses: [] })
    mockCreate.mockResolvedValue({})

    await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), vi.fn())

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: null, firstName: '', lastName: '' }),
    })
  })

  it('links the claimed invite to the new user once creation succeeds', async () => {
    mockGetAuth.mockReturnValue({ userId: 'user_new' })
    mockFindUnique.mockResolvedValue(null)
    mockClaimInvite.mockResolvedValue(true)
    mockGetUser.mockResolvedValue({ firstName: 'A', lastName: 'B', emailAddresses: [] })
    mockCreate.mockResolvedValue({ clerkId: 'user_new' })

    await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), vi.fn())

    expect(mockLinkClaimedInvite).toHaveBeenCalledWith('tok123', 'user_new')
  })

  // G411-81 — the real gate. App.jsx's SignIn-blocking (G411-41) only
  // stops our own UI; Clerk hosts sign-up at its own fixed URL, reachable
  // directly. These prove the actual enforcement point: no new User row
  // without a valid, unused invite, no matter how Clerk sign-up was reached.
  describe('G411-81 invite gate on new-user creation', () => {
    it('403s a brand-new user with no x-invite-token header at all', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_no_invite' })
      mockFindUnique.mockResolvedValue(null)
      mockClaimInvite.mockResolvedValue(false)
      const res = mockRes()
      const next = vi.fn()

      await requireAuth({}, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockGetUser).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('403s a brand-new user whose token does not exist or was already used (claimInvite fails, no existing User row either)', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_bad_token' })
      mockFindUnique.mockResolvedValue(null)
      mockClaimInvite.mockResolvedValue(false)
      const res = mockRes()
      const next = vi.fn()

      await requireAuth({ headers: { 'x-invite-token': 'nonexistent' } }, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockCreate).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('lets a brand-new user through with a valid, unused token (Falsifier: valid invite reaches a usable state)', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_good_token' })
      mockFindUnique.mockResolvedValue(null)
      mockClaimInvite.mockResolvedValue(true)
      mockGetUser.mockResolvedValue({ firstName: 'A', lastName: 'B', emailAddresses: [] })
      mockCreate.mockResolvedValue({ clerkId: 'user_good_token' })
      const next = vi.fn()

      await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), next)

      expect(mockCreate).toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    // Real bug hit live (Gavi): the client's AbortController fix (see
    // App.jsx) is the primary defense against StrictMode's duplicate
    // request, but this is a defense-in-depth check on the server for
    // ANY duplicate that reaches it anyway (a real retry, not just
    // StrictMode) — claimInvite failing should NOT 403 if the user
    // already exists (meaning a sibling request already finished).
    it('does not 403 if claimInvite fails but a User row already exists (sibling request already finished)', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_sibling_finished' })
      mockFindUnique
        .mockResolvedValueOnce(null) // outer check: not found yet
        .mockResolvedValueOnce({ clerkId: 'user_sibling_finished', firstName: 'Won The Race' }) // re-check after failed claim
      mockClaimInvite.mockResolvedValue(false)
      const next = vi.fn()

      await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), next)

      expect(mockGetUser).not.toHaveBeenCalled()
      expect(mockCreate).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    // Real edge case a genuine (non-StrictMode) concurrent duplicate can
    // hit: the sibling request that WON the claim is still mid-flight
    // (blocked on the Clerk API call) when this one re-checks — not
    // finished creating the User row yet. The bounded retry covers this
    // by trying again a couple more times before giving up.
    it('retries the User-row check a few times before 403ing, for a claim lost to a still-in-flight sibling', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_sibling_in_flight' })
      mockFindUnique
        .mockResolvedValueOnce(null) // outer check
        .mockResolvedValueOnce(null) // retry 1: sibling still mid-flight
        .mockResolvedValueOnce({ clerkId: 'user_sibling_in_flight', firstName: 'Finished Now' }) // retry 2: sibling done
      mockClaimInvite.mockResolvedValue(false)
      const next = vi.fn()

      await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), next)

      expect(mockFindUnique).toHaveBeenCalledTimes(3)
      expect(mockCreate).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('403s once retries are exhausted (genuinely invalid token, not just a slow sibling)', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_genuinely_no_invite' })
      mockFindUnique.mockResolvedValue(null) // never found, every attempt
      mockClaimInvite.mockResolvedValue(false)
      const res = mockRes()
      const next = vi.fn()

      await requireAuth({ headers: { 'x-invite-token': 'bad' } }, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('calls claimInvite before any Clerk API call or user creation, for a new user', async () => {
      mockGetAuth.mockReturnValue({ userId: 'user_order_check' })
      mockFindUnique.mockResolvedValue(null)
      const callOrder = []
      mockClaimInvite.mockImplementation(async () => {
        callOrder.push('claimInvite')
        return true
      })
      mockGetUser.mockImplementation(async () => {
        callOrder.push('getUser')
        return { firstName: 'A', lastName: 'B', emailAddresses: [] }
      })
      mockCreate.mockImplementation(async () => {
        callOrder.push('create')
        return { clerkId: 'user_order_check' }
      })

      await requireAuth({ headers: { 'x-invite-token': 'tok123' } }, mockRes(), vi.fn())

      expect(callOrder).toEqual(['claimInvite', 'getUser', 'create'])
    })
  })
})
