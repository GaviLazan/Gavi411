// One-time-per-need admin promotion (G411-76). No admin UI/route exists
// yet — that's a bigger, separate concern — but the promotion itself
// needs to be a reproducible, reviewable script, not a manual DB mutation
// that leaves no trace if the DB is ever reset or a new environment is
// stood up.
//
// Usage: node scripts/promote-admin.js <clerkId>
// Find the clerkId by matching against Clerk's dashboard/API — don't
// guess which Prisma row is which person from clerkId alone.

import { prisma } from '../server/lib/prisma.js'

const clerkId = process.argv[2]

if (!clerkId) {
  console.error('Usage: node scripts/promote-admin.js <clerkId>')
  process.exit(1)
}

const user = await prisma.user.update({
  where: { clerkId },
  data: { role: 'ADMIN' },
})

console.log(`Promoted ${user.email ?? user.clerkId} to ADMIN`)
await prisma.$disconnect()
