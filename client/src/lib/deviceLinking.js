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
  for (const { requestId, wrappedKey, iv } of keys) {
    const key = await unwrapConversationKey({ iv, ciphertext: wrappedKey }, devicePrivateKey, adminKey)
    result.set(requestId, key)
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
// uses — a request with no public key on file yet (friend never
// generated one) is skipped, nothing to wrap for it.
export async function approveDevice(device, adminPrivateKey, requestIds) {
  const devicePublicKey = await importPublicKey(device.publicKey)

  const wrappedKeys = []
  for (const requestId of requestIds) {
    const res = await fetch(`/api/requests/${requestId}/public-keys`)
    if (!res.ok) continue
    const { other } = await res.json()
    if (!other) continue // friend has no public key yet, nothing to wrap
    const friendPublicKey = await importPublicKey(other)
    const { iv, ciphertext } = await wrapConversationKey(adminPrivateKey, friendPublicKey, devicePublicKey)
    wrappedKeys.push({ requestId, wrappedKey: ciphertext, iv })
  }

  const res = await fetch(`/api/devices/${device.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wrappedKeys }),
  })
  if (!res.ok) throw new Error('Failed to approve device')
  return res.json()
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
