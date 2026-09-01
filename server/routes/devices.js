// Device-linking routes (G411-28, 2026-09-01) — mounted at /api/devices.
// See prisma/schema.prisma's Device/ConversationDeviceKey doc comments for
// the full mechanism. Server never sees a private key or a conversation
// key in the clear — it only ever stores/relays public keys and
// ECDH-wrapped conversation keys, same trust boundary as messages
// themselves (G411-82).

import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// POST / — a signed-in user's new device (no local key yet, or a key that
// doesn't match anything the server already has for them) asks to be
// linked. Creates a PENDING Device row and pings admin (see the stub
// below). Does not touch User.publicKey — that field stays whatever the
// account's original/primary device set at signup (G411-82); every device
// after that is a Device row here, approved or not.
router.post('/', requireAuth, async (req, res) => {
  const { publicKey } = req.body
  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: 'publicKey is required' })
  }

  const device = await prisma.device.create({
    data: { userId: req.user.clerkId, publicKey },
  })

  notifyAdminOfDeviceRequest(device, req.user)

  res.status(201).json(device)
})

// ponytail: no real Push/Telegram wiring here — that's the unbuilt
// Notifications epic's job (G411-29/49/50/51). This is a single, obvious
// call site for that epic to fill in later instead of having to find
// where a device request actually gets created.
function notifyAdminOfDeviceRequest(device, requestingUser) {
  console.log(
    `[device-request] ${requestingUser.firstName} ${requestingUser.lastName} (${requestingUser.clerkId}) requested a new device link, Device.id=${device.id}`,
  )
}

// GET /pending — admin's queue of unapproved device requests, each with
// enough of the requesting user's info to show a real name (not just a
// clerkId) — this is the exact query G411-37/38's eventual admin cockpit
// should call directly rather than re-deriving.
router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
  const pending = await prisma.device.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  })

  res.json(pending)
})

// POST /:id/approve — admin grants a pending device access to every
// conversation admin is a party to. The actual re-encryption (deriving
// each conversation's AES key, wrapping it for the new device's public
// key) happens client-side in admin's own browser, since only admin's
// session ever holds those keys in the clear (see
// client/src/lib/deviceLinking.js) — this route just persists the
// resulting wrapped keys and flips the Device to APPROVED, in one
// transaction so a partial failure can't leave a device marked approved
// with no usable keys, or vice versa.
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid device id' })
  }

  const { wrappedKeys } = req.body // [{ requestId, wrappedKey, iv }, ...]
  if (!Array.isArray(wrappedKeys)) {
    return res.status(400).json({ error: 'wrappedKeys array is required' })
  }

  const device = await prisma.device.findUnique({ where: { id } })
  if (!device || device.status !== 'PENDING') {
    return res.status(404).json({ error: 'Pending device not found' })
  }

  // Sibling review finding: this used to trust the client-submitted
  // requestId list wholesale — every other request-scoped route
  // (requests.js) gates through canAccessRequest first. Not exploitable
  // beyond what an admin already has blanket access to in this
  // single-admin app, but this is the actual fix for the client-side
  // over-wrapping bug this same review round found (InviteAdmin.jsx used
  // to hand this route every request in the system, not just the
  // device's own account's) — belt-and-suspenders so a client bug can't
  // silently wrap a key for the wrong device's owner again.
  const requestIds = wrappedKeys.map((k) => k.requestId)
  const ownedCount = await prisma.request.count({
    where: { id: { in: requestIds }, userId: device.userId },
  })
  if (ownedCount !== requestIds.length) {
    return res.status(400).json({ error: 'wrappedKeys must only reference the device owner\'s own requests' })
  }

  await prisma.$transaction([
    prisma.device.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    }),
    prisma.conversationDeviceKey.createMany({
      data: wrappedKeys.map((k) => ({
        requestId: k.requestId,
        deviceId: id,
        wrappedKey: k.wrappedKey,
        iv: k.iv,
      })),
      skipDuplicates: true, // a re-approved/retried request shouldn't 500 on the unique constraint
    }),
  ])

  res.json({ ok: true })
})

// POST /:id/reject — admin declines a pending device outright, no keys
// ever get wrapped for it.
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid device id' })
  }

  const device = await prisma.device.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'REJECTED' },
  })
  if (device.count === 0) {
    return res.status(404).json({ error: 'Pending device not found' })
  }

  res.json({ ok: true })
})

// GET /my-status — the caller's own most recent device row, if any (so a
// device that just called POST / can poll "am I approved yet?").
router.get('/my-status', requireAuth, async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { userId: req.user.clerkId },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ device })
})

// GET /my-keys — every wrapped conversation key belonging to one of the
// caller's own APPROVED devices, keyed by requestId, plus the admin's
// public key needed to unwrap them (ECDH is symmetric — the device
// derives the same wrapping key admin used, from its own private key +
// admin's public key). A device with no approved rows yet gets an empty
// list, same "nothing to decrypt yet" shape conversationCrypto.js already
// handles for a brand-new account with no public key at all.
router.get('/my-keys', requireAuth, async (req, res) => {
  const { deviceId } = req.query
  const id = Number(deviceId)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'deviceId query param is required' })
  }

  const device = await prisma.device.findUnique({ where: { id } })
  if (!device || device.userId !== req.user.clerkId || device.status !== 'APPROVED') {
    return res.status(404).json({ error: 'Approved device not found' })
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { publicKey: true },
  })

  const keys = await prisma.conversationDeviceKey.findMany({
    where: { deviceId: id },
    select: { requestId: true, wrappedKey: true, iv: true },
  })

  res.json({ adminPublicKey: admin?.publicKey ?? null, keys })
})

export default router
