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

import { clerkMiddleware, getAuth } from '@clerk/express'
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
  // User row if it doesn't exist yet. Keeps this decoupled from Neon at
  // wiring time — no separate webhook/sync step required for this task.
  // ponytail: no Clerk webhook sync (profile edits in Clerk won't
  // propagate here after creation) — add a user.updated webhook handler
  // if profile fields drift becomes a real problem.
  let user = await prisma.user.findUnique({ where: { clerkId: userId } })

  if (!user) {
    const claims = req.auth?.sessionClaims ?? {}
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        firstName: claims.firstName ?? '',
        lastName: claims.lastName ?? '',
        // Clerk manages email/phone verification; phoneNumber is required
        // + unique on our side, so this is a placeholder until the real
        // profile-completion flow (separate [You] task) fills it in.
        phoneNumber: claims.phoneNumber ?? `pending-${userId}`,
        creditBalance: 0,
      },
    })
  }

  req.user = user
  next()
}
