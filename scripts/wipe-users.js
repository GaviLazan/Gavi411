// One-time reset before the escrow-only E2E reframe (decision #98,
// gavi411-e2e-encryption-plan.md). Every current account predates a
// coherent key/escrow story — this wipes all User-linked data and every
// User row so accounts can be freshly re-onboarded through a real
// invite-signup (which runs escrow-at-signup automatically). No real
// friend data exists yet, so this is safe.
//
// Deletion order matters — every FK in prisma/schema.prisma is the
// Prisma/Postgres default (RESTRICT), so a naive `DELETE FROM "User"`
// fails outright wherever any dependent row still references it.
// Deepest-referencing tables first, User last:
//   ConversationDeviceKey -> Note/Message -> Device/PushSubscription/
//   CreditTransaction -> Request -> (null PendingInvite.usedByUserId,
//   don't delete the rows) -> User
//
// PendingInvite: every row is deleted EXCEPT the two real admin
// re-signup invites (labeled "Admin Invite" / "Admin Invite backup",
// created 2026-09-02, tokens hardcoded below) — including old, never-
// used test invites from previous sessions, which Gavi confirmed are
// stale clutter too, not just already-used ones. The two preserved
// invites specifically must survive the wipe, or the whole re-
// onboarding plan breaks (Gavi self-issues an invite for their own
// account BEFORE running this script, since POST /api/invites requires
// requireAdmin — wiping first would permanently lock admin out of ever
// issuing themself one; see gavi411-e2e-encryption-plan.md §4/§6 and
// CLAUDE.md's "trace consequences before proposing" rule, added after
// this exact ordering hazard was nearly missed live).
//
// Trigger (keyword-matching config) has no relation to User — untouched.
//
// Usage: node scripts/wipe-users.js
//   --dry-run   report counts only, delete nothing (default: false)
//   --yes       skip the interactive confirmation prompt

import { prisma } from '../server/lib/prisma.js'
import readline from 'node:readline/promises'

const dryRun = process.argv.includes('--dry-run')
const skipConfirm = process.argv.includes('--yes')

// Tokens for the two admin re-signup invites Gavi created and relabeled
// 2026-09-02, confirmed live against the DB before this script was
// written — these must never be deleted by this script.
const PRESERVED_INVITE_TOKENS = [
  'CWNTIiKdNl_0yfe-VJ-WaYymfCQDk4uk', // "Admin Invite"
  '8TCLSER0G-ZZkLFRu8nIKGyEM_zS4Pwf', // "Admin Invite backup"
]

const counts = {
  conversationDeviceKey: await prisma.conversationDeviceKey.count(),
  note: await prisma.note.count(),
  message: await prisma.message.count(),
  device: await prisma.device.count(),
  pushSubscription: await prisma.pushSubscription.count(),
  creditTransaction: await prisma.creditTransaction.count(),
  request: await prisma.request.count(),
  pendingInviteToDelete: await prisma.pendingInvite.count({
    where: { token: { notIn: PRESERVED_INVITE_TOKENS } },
  }),
  pendingInvitePreserved: await prisma.pendingInvite.count({
    where: { token: { in: PRESERVED_INVITE_TOKENS } },
  }),
  user: await prisma.user.count(),
}

console.log('Rows that will be deleted (pendingInvitePreserved is the only exception — kept):')
console.table(counts)

if (counts.pendingInvitePreserved !== PRESERVED_INVITE_TOKENS.length) {
  console.error(
    `Expected ${PRESERVED_INVITE_TOKENS.length} preserved invites to exist, found ${counts.pendingInvitePreserved}. ` +
      'Refusing to proceed — check PRESERVED_INVITE_TOKENS against the real DB before re-running.',
  )
  await prisma.$disconnect()
  process.exit(1)
}

if (dryRun) {
  console.log('--dry-run: nothing deleted.')
  await prisma.$disconnect()
  process.exit(0)
}

if (!skipConfirm) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `This will permanently delete ALL ${counts.user} User rows and everything listed above. Type "wipe" to continue: `,
  )
  rl.close()
  if (answer.trim() !== 'wipe') {
    console.log('Aborted — no changes made.')
    await prisma.$disconnect()
    process.exit(1)
  }
}

await prisma.$transaction([
  prisma.conversationDeviceKey.deleteMany(),
  prisma.note.deleteMany(),
  prisma.message.deleteMany(),
  prisma.device.deleteMany(),
  prisma.pushSubscription.deleteMany(),
  prisma.creditTransaction.deleteMany(),
  prisma.request.deleteMany(),
  prisma.pendingInvite.deleteMany({ where: { token: { notIn: PRESERVED_INVITE_TOKENS } } }),
  prisma.user.deleteMany(),
])

console.log('Wipe complete.')
console.log('Next: sign up through a real (still-valid) invite link, then')
console.log('run `node scripts/promote-admin.js <clerkId>` to restore admin.')
await prisma.$disconnect()
