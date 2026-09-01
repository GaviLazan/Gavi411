// Device-linking routes (G411-28, 2026-09-01) — mounted at /api/devices.
// See prisma/schema.prisma's Device/ConversationDeviceKey doc comments for
// the full mechanism. Server never sees a private key or a conversation
// key in the clear — it only ever stores/relays public keys and
// ECDH-wrapped conversation keys, same trust boundary as messages
// themselves (G411-82).

import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { sendPushToUser } from '../lib/webPush.js'

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

  notifyAdminOfDeviceRequest(device, req.user).catch((err) =>
    console.error('notifyAdminOfDeviceRequest failed:', err),
  )

  res.status(201).json(device)
})

// G411-29: first real Web Push integration point. Which OTHER events also
// push (new message, status change, etc.) is G411-51's trigger-matrix
// job — this one call site was already stubbed out for exactly this. A
// push failure here (no admin subscription yet, delivery error — both
// handled inside sendPushToUser) must never break device-request creation
// itself, so this stays fire-and-forget from the route's perspective.
async function notifyAdminOfDeviceRequest(device, requestingUser) {
  console.log(
    `[device-request] ${requestingUser.firstName} ${requestingUser.lastName} (${requestingUser.clerkId}) requested a new device link, Device.id=${device.id}`,
  )

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
  await Promise.all(
    admins.map((admin) =>
      sendPushToUser(admin.clerkId, {
        title: 'New device link request',
        body: `${requestingUser.firstName} ${requestingUser.lastName} wants to link a new device`,
      }),
    ),
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
    return res.status(400).json({ error: "wrappedKeys must only reference the device owner's own requests" })
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

// GET /missing-wraps — admin-only self-healing check (Matan's Sibling
// review, PR #35, Fix 1a): a linked device approved BEFORE some Request
// existed has no ConversationDeviceKey row for it — getConversationKey
// now refuses to derive a wrong key for that case (see
// conversationCrypto.js), so this route is how admin's browser finds
// which (device, request) pairs still need wrapping. Optional `requestId`
// query param scopes the check to one Request (RequestDetail.jsx's
// per-page trigger); omitted, it checks every APPROVED device's owner's
// requests (App.jsx's on-load sweep).
router.get('/missing-wraps', requireAuth, requireAdmin, async (req, res) => {
  const { requestId } = req.query
  const requestFilter = requestId ? { id: Number(requestId) } : {}
  if (requestId && !Number.isInteger(requestFilter.id)) {
    return res.status(400).json({ error: 'Invalid requestId' })
  }

  const devices = await prisma.device.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, userId: true, publicKey: true },
  })
  if (devices.length === 0) return res.json([])

  const requests = await prisma.request.findMany({
    where: { ...requestFilter, userId: { in: devices.map((d) => d.userId) } },
    select: { id: true, userId: true },
  })
  if (requests.length === 0) return res.json([])

  const existing = await prisma.conversationDeviceKey.findMany({
    where: {
      deviceId: { in: devices.map((d) => d.id) },
      requestId: { in: requests.map((r) => r.id) },
    },
    select: { deviceId: true, requestId: true },
  })
  const existingSet = new Set(existing.map((k) => `${k.deviceId}:${k.requestId}`))

  const missing = []
  for (const device of devices) {
    for (const request of requests) {
      if (request.userId !== device.userId) continue
      if (existingSet.has(`${device.id}:${request.id}`)) continue
      missing.push({ deviceId: device.id, requestId: request.id, devicePublicKey: device.publicKey })
    }
  }

  res.json(missing)
})

// POST /wrap-additional — persists wrapped keys for (device, request)
// pairs found via GET /missing-wraps above. Deliberately separate from
// POST /:id/approve: that route also flips a PENDING device to APPROVED,
// which must NOT re-fire here (the devices this route serves are already
// APPROVED — this is just filling in keys for requests that showed up
// after approval, or that got skipped as "friend has no public key yet"
// at the time). Same ownership check as /:id/approve, applied per-key
// since wrappedKeys here can span multiple devices at once (App.jsx's
// on-load sweep can be healing several linked devices in one pass).
router.post('/wrap-additional', requireAuth, requireAdmin, async (req, res) => {
  const { wrappedKeys } = req.body // [{ deviceId, requestId, wrappedKey, iv }, ...]
  if (!Array.isArray(wrappedKeys) || wrappedKeys.length === 0) {
    return res.status(400).json({ error: 'wrappedKeys array is required' })
  }

  const deviceIds = [...new Set(wrappedKeys.map((k) => k.deviceId))]
  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds }, status: 'APPROVED' },
    select: { id: true, userId: true },
  })
  const ownerByDeviceId = new Map(devices.map((d) => [d.id, d.userId]))
  if (ownerByDeviceId.size !== deviceIds.length) {
    return res.status(400).json({ error: 'wrappedKeys must only reference approved devices' })
  }

  const requestIds = [...new Set(wrappedKeys.map((k) => k.requestId))]
  const requests = await prisma.request.findMany({
    where: { id: { in: requestIds } },
    select: { id: true, userId: true },
  })
  const ownerByRequestId = new Map(requests.map((r) => [r.id, r.userId]))

  const allOwned = wrappedKeys.every((k) => ownerByRequestId.get(k.requestId) === ownerByDeviceId.get(k.deviceId))
  if (!allOwned) {
    return res.status(400).json({ error: "wrappedKeys must only reference the device owner's own requests" })
  }

  await prisma.conversationDeviceKey.createMany({
    data: wrappedKeys.map((k) => ({
      requestId: k.requestId,
      deviceId: k.deviceId,
      wrappedKey: k.wrappedKey,
      iv: k.iv,
    })),
    skipDuplicates: true,
  })

  res.json({ ok: true })
})

// GET /my-status — polls one device's own approval status. Matan's
// Sibling review, carried-over non-blocking note: this used to always
// return the account's most-recently-created Device row regardless of
// which device was actually asking — an account that requested linking
// from two different devices could have one device's poll reflect the
// OTHER device's status. An optional `deviceId` query param (the caller's
// own saved id, once requestDeviceLink() has one — see deviceLinking.js)
// scopes the lookup to that exact row; omitted (or not owned by this
// user — falls through the same as omitted, no 404, since this is just a
// polling convenience, not a security boundary), falls back to the
// original most-recent behavior for the brief window before a deviceId
// exists yet.
router.get('/my-status', requireAuth, async (req, res) => {
  const { deviceId } = req.query
  const id = Number(deviceId)

  const device = Number.isInteger(id)
    ? await prisma.device.findFirst({ where: { id, userId: req.user.clerkId } })
    : await prisma.device.findFirst({
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
