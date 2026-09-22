// Device-linking: request and approve new devices.
// Separate from conversationCrypto.js (per-message) and escrow.js (signup-time).

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

// Poll this device's approval status (scoped by saved deviceId when it exists).
export async function getMyDeviceStatus() {
  const deviceId = await loadDeviceId()
  const query = deviceId != null ? `?deviceId=${deviceId}` : ''
  const res = await fetch(`/api/devices/my-status${query}`)
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
  // Per-key try/catch: one bad wrap doesn't discard already-unwrapped keys.
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

// Approve pending device: wrap every conversation for device's public key.
// Runs wraps concurrently via Promise.all; returns skipped requestIds if friend has no public key.
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

// Self-healing sweep: fill in missing wraps for approved devices.
// Silently best-effort; needsKeypair banner still present if it doesn't fix things.
export async function wrapMissingConversationKeys(adminPrivateKey, requestId) {
  const query = requestId != null ? `?requestId=${requestId}` : ''
  const res = await fetch(`/api/devices/missing-wraps${query}`)
  if (!res.ok) return
  const missing = await res.json()
  if (missing.length === 0) return

  // Run wraps concurrently via Promise.all (each pair is independent).
  const results = await Promise.all(
    missing.map(async ({ deviceId, requestId: reqId, devicePublicKey }) => {
      const devicePublic = await importPublicKey(devicePublicKey)
      const { wrapped } = await wrapForRequests(adminPrivateKey, devicePublic, [reqId])
      return wrapped.map((w) => ({ ...w, deviceId }))
    }),
  )
  const wrappedKeys = results.flat()
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
