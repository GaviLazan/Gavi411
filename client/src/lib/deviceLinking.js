// Device-linking orchestration (G411-28, 2026-09-01). Two roles use this
// file: a new device requesting access, and admin's browser approving one.
// Kept separate from conversationCrypto.js (per-message send/receive) and
// escrow.js (signup-time backup) — this is a distinct lifecycle event, not
// something that happens on every message or every signup.

import { generateKeypair, exportPublicKey, importPublicKey, wrapConversationKey, unwrapConversationKey } from './crypto.js'
import { savePrivateKey, saveDeviceId, loadDeviceId, loadPrivateKey } from './keyStore.js'

// Called from a new device with no local key (or an explicit "link this
// device" action) — generates this device's own keypair, saves the
// private half locally, and asks the server to create a PENDING request
// with the public half. Returns the created Device row (mainly its id).
export async function requestDeviceLink() {
  const keypair = await generateKeypair()
  await savePrivateKey(keypair.privateKey)
  const publicKey = await exportPublicKey(keypair.publicKey)

  const res = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  })
  if (!res.ok) throw new Error('Failed to request device link')
  const device = await res.json()
  await saveDeviceId(device.id)
  return device
}

// Polls this device's own approval status.
export async function getMyDeviceStatus() {
  const res = await fetch('/api/devices/my-status')
  if (!res.ok) return null
  const { device } = await res.json()
  return device
}

// Called once this device's status is APPROVED — fetches its wrapped
// conversation keys and admin's public key, unwraps each, returns a Map
// of requestId -> CryptoKey ready to hand straight to
// conversationCrypto.js's decrypt path (that module's own cache keys on
// requestId too, so this can seed it directly).
export async function loadLinkedConversationKeys() {
  const deviceId = await loadDeviceId()
  if (!deviceId) return new Map()

  const res = await fetch(`/api/devices/my-keys?deviceId=${deviceId}`)
  if (!res.ok) return new Map()
  const { adminPublicKey, keys } = await res.json()
  if (!adminPublicKey || keys.length === 0) return new Map()

  const devicePrivateKey = await loadPrivateKey()
  if (!devicePrivateKey) return new Map()

  const adminKey = await importPublicKey(adminPublicKey)
  const result = new Map()
  // Sibling review finding: one bad/mismatched wrapped key used to throw
  // out of this whole loop, discarding every already-unwrapped key too —
  // silently, since the caller (App.jsx) wraps this in a bare .catch().
  // A per-key try/catch means one bad row costs that one conversation,
  // not the entire linked-device experience.
  for (const { requestId, wrappedKey, iv } of keys) {
    try {
      const key = await unwrapConversationKey({ iv, ciphertext: wrappedKey }, devicePrivateKey, adminKey)
      result.set(requestId, key)
    } catch (err) {
      console.error(`Failed to unwrap conversation key for request ${requestId}:`, err)
    }
  }
  return result
}

// Admin-side: approves a pending device by wrapping EVERY conversation
// admin is a party to for that device's public key, in one batch (Gavi's
// call — new device inherits full history immediately, see G411-28's Jira
// description). `adminPrivateKey` is admin's own loaded private key.
// wrapConversationKey needs the friend's raw public key (not the derived
// CryptoKey conversationCrypto.js normally works with — see that
// function's own doc comment for why), so this re-fetches it per request
// from the same /public-keys route the normal send/receive path already
// uses. `requestIds` is expected to already be scoped to the device
// owner's own requests — see InviteAdmin.jsx's caller and devices.js's
// server-side ownership check for the actual enforcement (Sibling review
// finding: this function used to be handed every request in the system).
//
// Sibling review findings, both fixed here: (1) per-request work ran
// sequentially (one network round trip at a time) — Promise.all runs them
// concurrently instead, since each request's wrap is fully independent.
// (2) a request with no friend public key yet was silently skipped with
// no record — skippedRequestIds is now returned so the caller can warn
// admin that device inherits full history is NOT yet true for those
// conversations, and returns which ones so a future retry can target
// exactly them (see this function's own comment for why "run approve
// again later" isn't automatic yet — no re-run trigger exists today).
// Wraps one already-imported device public key for each requestId in
// `requestIds`, using admin's own private key + each request's friend
// public key (re-fetched per request — see this file's other doc comments
// for why the derived CryptoKey conversationCrypto.js normally works with
// isn't enough here). Shared by approveDevice (fresh approval, wraps every
// request at once) and the missing-wraps sweep below (wraps just the
// specific requests a GET /missing-wraps check found) — pulled out
// (Matan's Sibling review, PR #35, Fix 1a) so "wrap these specific
// (device, request) pairs" isn't reimplemented for the sweep.
async function wrapForRequests(adminPrivateKey, devicePublicKey, requestIds) {
  const results = await Promise.all(
    requestIds.map(async (requestId) => {
      const res = await fetch(`/api/requests/${requestId}/public-keys`)
      if (!res.ok) return { requestId, skipped: true }
      const { other } = await res.json()
      if (!other) return { requestId, skipped: true } // friend has no public key yet, nothing to wrap
      const friendPublicKey = await importPublicKey(other)
      const { iv, ciphertext } = await wrapConversationKey(adminPrivateKey, friendPublicKey, devicePublicKey)
      return { requestId, wrappedKey: ciphertext, iv, skipped: false }
    }),
  )

  const wrapped = results.filter((r) => !r.skipped).map(({ skipped, ...rest }) => rest)
  const skippedRequestIds = results.filter((r) => r.skipped).map((r) => r.requestId)
  return { wrapped, skippedRequestIds }
}

export async function approveDevice(device, adminPrivateKey, requestIds) {
  const devicePublicKey = await importPublicKey(device.publicKey)
  const { wrapped, skippedRequestIds } = await wrapForRequests(adminPrivateKey, devicePublicKey, requestIds)

  const res = await fetch(`/api/devices/${device.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wrappedKeys: wrapped }),
  })
  if (!res.ok) throw new Error('Failed to approve device')
  const body = await res.json()
  return { ...body, skippedRequestIds }
}

// Self-healing sweep (Matan's Sibling review, PR #35, Fix 1a): finds and
// fills in any (approved device, request) pair still missing a wrapped
// key — e.g. a request created after the device was already approved.
// `requestId` scopes the check to one Request (RequestDetail.jsx's
// per-page trigger); omitted, it checks every linked device's owner's
// requests (App.jsx's on-load sweep). Silently no-ops on any failure —
// this is a background best-effort heal, not a user-facing action; the
// existing needsKeypair banner is still there if it doesn't manage to fix
// things this pass.
export async function wrapMissingConversationKeys(adminPrivateKey, requestId) {
  const query = requestId != null ? `?requestId=${requestId}` : ''
  const res = await fetch(`/api/devices/missing-wraps${query}`)
  if (!res.ok) return
  const missing = await res.json()
  if (missing.length === 0) return

  const wrappedKeys = []
  for (const { deviceId, requestId: reqId, devicePublicKey } of missing) {
    const devicePublic = await importPublicKey(devicePublicKey)
    const { wrapped } = await wrapForRequests(adminPrivateKey, devicePublic, [reqId])
    for (const w of wrapped) wrappedKeys.push({ ...w, deviceId })
  }
  if (wrappedKeys.length === 0) return

  await fetch('/api/devices/wrap-additional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wrappedKeys }),
  })
}

export async function rejectDevice(deviceId) {
  const res = await fetch(`/api/devices/${deviceId}/reject`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to reject device')
  return res.json()
}

export async function getPendingDevices() {
  const res = await fetch('/api/devices/pending')
  if (!res.ok) return []
  return res.json()
}
