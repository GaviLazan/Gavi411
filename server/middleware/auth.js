// Clerk auth middleware (G411-13, [Agentic])
//
// Uses Clerk's own Express SDK (@clerk/express) rather than hand-rolling
// JWT verification — it already knows how to verify a Clerk session token
// (JWT under the hood) against Clerk's public keys and expose the result.
// Docs: https://clerk.com/docs/references/express/overview
//
// Setup Gavi needs to do (can't be verified without these):
//   1. Create a Clerk app at https://dashboard.clerk.com
//   2. Copy the Secret Key and Publishable Key from Clerk's API Keys page
//   3. Add to server/.env (see server/.env.example):
//        CLERK_SECRET_KEY=sk_test_...
//        CLERK_PUBLISHABLE_KEY=pk_test_...
//   4. @clerk/express reads CLERK_SECRET_KEY from process.env automatically
//      (via clerkMiddleware() in server.js) — no manual key-passing needed
//      as long as dotenv/config has already loaded it.

import { clerkMiddleware, clerkClient, getAuth } from '@clerk/express'
import { prisma } from '../lib/prisma.js'

// clerkClient — call once per server, mounted globally in server.js.
// Reads the session cookie / Authorization: Bearer <token> header on every
// request and (if present+valid) populates req.auth. Does NOT reject
// unauthenticated requests by itself — that's requireAuth's job below.
export { clerkMiddleware }

// requireAuth — protects a route: 401s if there's no valid Clerk session,
// otherwise loads the matching User row (keyed by clerkId, per
// prisma/schema.prisma) and attaches it as req.user.
//
// Ponytail: no separate "attachUser"/"requireAuth" split — one middleware,
// since every route that needs a user also needs auth. Split them if a
// route ever needs optional auth (user attached if present, not required).
export async function requireAuth(req, res, next) {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // First authenticated request from a given Clerk user: create the local
  // User row if it doesn't exist yet.
  //
  // G411-76: session-JWT claims (req.auth.sessionClaims) do NOT include
  // firstName/lastName/email without a custom Clerk JWT template — none is
  // configured, so every row created via the old claims-based code had
  // permanently blank names. Fetching the real user record from Clerk's
  // Backend API on creation gets the actual data instead.
  // ponytail: only synced at creation, not on every later request — a
  // user who edits their name/email in Clerk afterward won't see it
  // reflected here. Add a `user.updated` webhook (or push-back sync,
  // G411-80) if that drift becomes a real problem; not worth the extra
  // API call on every request at this app's scale.
  let user = await prisma.user.findUnique({ where: { clerkId: userId } })

  if (!user) {
    let clerkUser
    try {
      clerkUser = await clerkClient.users.getUser(userId)
    } catch (err) {
      console.error('Failed to fetch user from Clerk:', err)
      return res.status(503).json({ error: 'Unable to verify session, try again' })
    }

    // emailAddresses[0] isn't guaranteed to be the primary — look it up by
    // primaryEmailAddressId. Fall back defensively if the shape is ever
    // missing (empty array, or an unexpected partial response).
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
          // Clerk manages phone verification and doesn't support Israeli
          // numbers, so phone is collected in our own app instead
          // (G411-69) — phoneNumber is required + unique on our side, so
          // this is a placeholder until that flow fills it in.
          phoneNumber: `pending-${userId}`,
          creditBalance: 0,
        },
      })
    } catch (err) {
      // Race: two near-simultaneous first requests from the same new user
      // both saw findUnique return null, then both tried to create — the
      // second create hits the unique constraint (phoneNumber). Just use
      // the row the first request created instead of erroring.
      if (err.code === 'P2002') {
        user = await prisma.user.findUnique({ where: { clerkId: userId } })
      } else {
        throw err
      }
    }

    // G411-41: mark the invite token used, linked to the new user, on the
    // very first authenticated request after signup. Best-effort only —
    // an invalid/missing token here does NOT block account creation, since
    // this middleware isn't the gate (that's G411-81's job, still open).
    // The client stashes the token client-side before OAuth redirect and
    // sends it back via this header once signed in (see client/src/lib/
    // inviteToken.js) — a plain `?token=` URL param can't be relied on to
    // survive Clerk's own OAuth redirect round trip.
    const inviteToken = req.headers?.['x-invite-token']
    if (inviteToken) {
      await prisma.pendingInvite.updateMany({
        where: { token: inviteToken, usedAt: null },
        data: { usedAt: new Date(), usedByUserId: user.clerkId },
      })
    }
  }

  req.user = user
  next()
}
