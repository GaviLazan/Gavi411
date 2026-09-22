// Clerk auth middleware. Uses @clerk/express rather than hand-rolling JWT
// verification. Docs: https://clerk.com/docs/references/express/overview
//
// Requires CLERK_SECRET_KEY/CLERK_PUBLISHABLE_KEY in server/.env (see
// server/.env.example) — read automatically by clerkMiddleware() below.

import { clerkMiddleware, clerkClient, getAuth } from '@clerk/express'
import { prisma } from '../lib/prisma.js'
import { claimInvite, linkClaimedInvite, unclaimInvite } from '../lib/invites.js'
import { initialCreditFor } from '../lib/credits.js'

// Mounted globally in server.js. Populates req.auth if a valid session is
// present, but doesn't reject unauthenticated requests itself — that's
// requireAuth's job below.
export { clerkMiddleware }

// Protects a route: 401s with no valid Clerk session, otherwise loads the
// matching User row (keyed by clerkId) and attaches it as req.user.
export async function requireAuth(req, res, next) {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // First authenticated request from a given Clerk user: create the local
  // User row if it doesn't exist yet, fetching real name/email from
  // Clerk's Backend API (session-JWT claims alone don't include them).
  //
  // ponytail: synced at signup + on Profile-page exit (see completeProfile.js's
  // sync-from-clerk route) — a Clerk edit made elsewhere still needs a real
  // webhook (G411-127) to reach here immediately.
  let user = await prisma.user.findUnique({ where: { clerkId: userId } })

  if (!user) {
    // Real invite-gate enforcement point: no new User row without a valid,
    // unused invite token, regardless of how the visitor reached Clerk
    // sign-up (Clerk's hosted portal is reachable independent of our UI).
    //
    // claimInvite() is a single atomic conditional UPDATE — its own WHERE
    // clause is the validity check, closing the TOCTOU window a separate
    // read-then-claim would have. Runs before any Clerk API call or DB
    // write. usedByUserId is filled in later by linkClaimedInvite() once
    // the User row exists (it's a FK that doesn't exist yet here).
    //
    // React StrictMode double-fires this request in dev, so a genuine
    // signup can hit claimInvite() twice nearly simultaneously — a failed
    // claim re-checks for a User row before 403ing, in case the sibling
    // request already finished creating it.
    const inviteToken = req.headers?.['x-invite-token']
    const claimed = await claimInvite(inviteToken)

    if (!claimed) {
      // Bounded retry: the sibling StrictMode request may still be
      // mid-flight (blocked on the Clerk API call below) rather than
      // finished — not necessarily an invalid token.
      for (let attempt = 0; attempt < 3 && !user; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 150))
        user = await prisma.user.findUnique({ where: { clerkId: userId } })
      }
    }

    if (!user) {
      if (!claimed) {
        return res.status(403).json({ error: 'A valid invite is required to sign up' })
      }

      let clerkUser
      try {
        clerkUser = await clerkClient.users.getUser(userId)
      } catch (err) {
        console.error('Failed to fetch user from Clerk:', err)
        // The invite was already atomically claimed above (needed to run
        // before this call to close the TOCTOU race) — if account
        // creation fails from here on, un-claim it so the same invite
        // link still works on retry, instead of permanently burning a
        // valid invite on an unrelated Clerk-API hiccup.
        await unclaimInvite(inviteToken)
        return res.status(503).json({ error: 'Unable to verify session, try again' })
      }

      // emailAddresses[0] isn't guaranteed to be the primary — look it up
      // by primaryEmailAddressId. Fall back defensively if the shape is
      // ever missing (empty array, or an unexpected partial response).
      const emails = clerkUser.emailAddresses ?? []
      const primaryEmail = emails.find((e) => e.id === clerkUser.primaryEmailAddressId)
      const email = primaryEmail?.emailAddress ?? emails[0]?.emailAddress ?? null

      try {
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            firstName: clerkUser.firstName ?? '',
            lastName: clerkUser.lastName ?? '',
            email,
            phoneNumber: `pending-${userId}`, // Clerk doesn't support Israeli numbers; collected in-app instead
            ...(clerkUser.hasImage ? { profilePic: clerkUser.imageUrl } : {}),
            username: clerkUser.username ?? null,
            // groupTag isn't collected at signup, so every new user gets
            // initialCreditFor's REGULAR-tier amount today.
            creditBalance: initialCreditFor(undefined),
            // null (not 0) means "never reset yet" to the monthly reset job
            creditsResetAt: new Date(),
          },
        })
      } catch (err) {
        // Race: two near-simultaneous first requests from the same new
        // user both saw findUnique return null, then both tried to
        // create — the second create hits the unique constraint
        // (phoneNumber). Just use the row the first request created
        // instead of erroring.
        if (err.code === 'P2002') {
          user = await prisma.user.findUnique({ where: { clerkId: userId } })
        } else {
          throw err
        }
      }

      await linkClaimedInvite(inviteToken, user.clerkId)
    }
  }

  // Soft-deleted accounts are locked out here, not just PII-scrubbed — a
  // Clerk-delete failure during DELETE /api/me could otherwise leave a
  // still-valid session usable under a "deleted" account.
  if (user.isDeleted) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Reversible (unlike isDeleted) — clearing isBlocked re-enables immediately.
  if (user.isBlocked) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.user = user
  next()
}

// Chains after requireAuth (needs req.user set). 404s rather than 403s
// for a non-admin — no-route-existence-leak convention used app-wide.
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Not found' })
  }
  next()
}
