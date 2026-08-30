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
import { claimInvite, linkClaimedInvite, unclaimInvite } from '../lib/invites.js'

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
    // G411-81: the real gate. App.jsx's SignIn-blocking (G411-41) only
    // stops our own UI from offering sign-up — Clerk hosts its own
    // account portal at a fixed, guessable URL (independent of our
    // React app) that anyone can reach directly, bypassing that UI
    // entirely. This is the actual enforcement point: no NEW User row
    // gets created without a valid, unused invite token in the same
    // request, no matter how the visitor reached Clerk sign-up. An
    // account created by going around our UI ends up with a real Clerk
    // identity but no linked app data — permanently stuck at this 403,
    // never a usable signed-in state (this ticket's Falsifier).
    //
    // Sibling review finding: this used to be a read-only check
    // (findUnique + !invite.usedAt) with the actual claim happening
    // separately, much later — a real window (spanning a Clerk API call
    // and a DB write) where two concurrent signups sharing one token
    // could both pass the read-check before either claimed it, letting
    // one single-use invite seed two accounts. claimInvite() is a single
    // atomic conditional UPDATE — its own WHERE clause IS the validity
    // check, so "claimed" and "valid" can no longer disagree between two
    // racing requests. Runs BEFORE any Clerk API call or DB write, so an
    // invalid/already-claimed token is rejected as cheaply as possible.
    //
    // Two-phase (see lib/invites.js): claimInvite() only sets `usedAt`
    // here — usedByUserId is a foreign key to User.clerkId, which
    // doesn't exist yet at this point, so it can't be set in this same
    // write (hit live: FK violation on an earlier single-write version).
    // linkClaimedInvite() fills usedByUserId in once the User row exists.
    //
    // React StrictMode (dev) double-fires the request carrying this
    // header, so the SAME legitimate signup genuinely sends it twice,
    // nearly simultaneously. If claimInvite() fails here, it's either a
    // genuinely invalid/already-used token (403), or this request's own
    // duplicate lost the race to its sibling — distinguished by
    // re-checking for a User row: if one now exists (the sibling
    // finished creating it), fall through and use it instead of 403ing
    // a real signup.
    const inviteToken = req.headers?.['x-invite-token']
    const claimed = await claimInvite(inviteToken)

    if (!claimed) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } })
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
            // Clerk manages phone verification and doesn't support
            // Israeli numbers, so phone is collected in our own app
            // instead (G411-69) — phoneNumber is required + unique on
            // our side, so this is a placeholder until that flow fills
            // it in.
            phoneNumber: `pending-${userId}`,
            creditBalance: 0,
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

  req.user = user
  next()
}
