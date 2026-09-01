// G411-28 device-linking orchestration. Matan's Sibling review (PR #35)
// explicitly flagged this file as untested — "no tests exist for
// deviceLinking.js or the new conversationCrypto.js path, exactly where
// the two High findings live." Same convention as conversationCrypto.test.js:
// real Web Crypto, mocked fetch + keyStore.js (browser-only, untested by
// design).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeypair, exportPublicKey } from './crypto.js'

const mockLoadDeviceId = vi.fn()
vi.mock('./keyStore.js', () => ({
  savePrivateKey: vi.fn(),
  saveDeviceId: vi.fn(),
  loadDeviceId: (...args) => mockLoadDeviceId(...args),
  loadPrivateKey: vi.fn(),
}))

const { approveDevice, wrapMissingConversationKeys, getMyDeviceStatus } = await import('./deviceLinking.js')

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  mockLoadDeviceId.mockResolvedValue(null)
})

describe('approveDevice', () => {
  it('wraps every requestId and reports the ones skipped for lack of a friend public key', async () => {
    const admin = await generateKeypair()
    const device = { id: 1, publicKey: await exportPublicKey((await generateKeypair()).publicKey) }
    const friend = await generateKeypair()
    const friendPublicB64 = await exportPublicKey(friend.publicKey)

    fetch.mockImplementation((url) => {
      if (url === '/api/requests/5/public-keys') {
        return Promise.resolve({ ok: true, json: async () => ({ other: friendPublicB64 }) })
      }
      if (url === '/api/requests/6/public-keys') {
        return Promise.resolve({ ok: true, json: async () => ({ other: null }) }) // friend has no key yet
      }
      if (url === '/api/devices/1/approve') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await approveDevice(device, admin.privateKey, [5, 6])

    expect(result.skippedRequestIds).toEqual([6])
    const approveCall = fetch.mock.calls.find(([url]) => url === '/api/devices/1/approve')
    const body = JSON.parse(approveCall[1].body)
    expect(body.wrappedKeys).toHaveLength(1)
    expect(body.wrappedKeys[0].requestId).toBe(5)
  })

  it('throws when the approve route itself fails', async () => {
    const admin = await generateKeypair()
    const device = { id: 1, publicKey: await exportPublicKey((await generateKeypair()).publicKey) }
    fetch.mockResolvedValue({ ok: false })

    await expect(approveDevice(device, admin.privateKey, [])).rejects.toThrow('Failed to approve device')
  })
})

// Matan's Sibling review, PR #35, Fix 1a.
describe('wrapMissingConversationKeys', () => {
  it('no-ops when the missing-wraps check fails', async () => {
    const admin = await generateKeypair()
    fetch.mockResolvedValue({ ok: false })

    await wrapMissingConversationKeys(admin.privateKey)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('no-ops when nothing is missing', async () => {
    const admin = await generateKeypair()
    fetch.mockResolvedValue({ ok: true, json: async () => [] })

    await wrapMissingConversationKeys(admin.privateKey)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('wraps each missing pair and posts them to wrap-additional, scoped by requestId when given', async () => {
    const admin = await generateKeypair()
    const linkedDevice = await generateKeypair()
    const devicePublicB64 = await exportPublicKey(linkedDevice.publicKey)
    const friend = await generateKeypair()
    const friendPublicB64 = await exportPublicKey(friend.publicKey)

    fetch.mockImplementation((url) => {
      if (url === '/api/devices/missing-wraps?requestId=6') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ deviceId: 1, requestId: 6, devicePublicKey: devicePublicB64 }],
        })
      }
      if (url === '/api/requests/6/public-keys') {
        return Promise.resolve({ ok: true, json: async () => ({ other: friendPublicB64 }) })
      }
      if (url === '/api/devices/wrap-additional') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await wrapMissingConversationKeys(admin.privateKey, 6)

    const postCall = fetch.mock.calls.find(([url]) => url === '/api/devices/wrap-additional')
    expect(postCall).toBeTruthy()
    const body = JSON.parse(postCall[1].body)
    expect(body.wrappedKeys).toEqual([
      expect.objectContaining({ deviceId: 1, requestId: 6 }),
    ])
  })

  it('does not call wrap-additional when every missing pair is skipped (friend still has no key)', async () => {
    const admin = await generateKeypair()
    const linkedDevice = await generateKeypair()
    const devicePublicB64 = await exportPublicKey(linkedDevice.publicKey)

    fetch.mockImplementation((url) => {
      if (url === '/api/devices/missing-wraps') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ deviceId: 1, requestId: 6, devicePublicKey: devicePublicB64 }],
        })
      }
      if (url === '/api/requests/6/public-keys') {
        return Promise.resolve({ ok: true, json: async () => ({ other: null }) })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await wrapMissingConversationKeys(admin.privateKey)

    expect(fetch.mock.calls.some(([url]) => url === '/api/devices/wrap-additional')).toBe(false)
  })

  // Sequential-vs-parallel nit from Matan's 2nd approval round: each pair
  // is independent, so several missing pairs should wrap concurrently
  // rather than one fetch round trip waiting on the last.
  it('wraps multiple missing pairs concurrently, not one at a time', async () => {
    const admin = await generateKeypair()
    const deviceA = await generateKeypair()
    const deviceB = await generateKeypair()
    const devicePublicA = await exportPublicKey(deviceA.publicKey)
    const devicePublicB = await exportPublicKey(deviceB.publicKey)
    const friend = await generateKeypair()
    const friendPublicB64 = await exportPublicKey(friend.publicKey)

    fetch.mockImplementation((url) => {
      if (url === '/api/devices/missing-wraps') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { deviceId: 1, requestId: 6, devicePublicKey: devicePublicA },
            { deviceId: 2, requestId: 7, devicePublicKey: devicePublicB },
          ],
        })
      }
      if (url === '/api/requests/6/public-keys' || url === '/api/requests/7/public-keys') {
        return Promise.resolve({ ok: true, json: async () => ({ other: friendPublicB64 }) })
      }
      if (url === '/api/devices/wrap-additional') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await wrapMissingConversationKeys(admin.privateKey)

    const postCall = fetch.mock.calls.find(([url]) => url === '/api/devices/wrap-additional')
    const body = JSON.parse(postCall[1].body)
    expect(body.wrappedKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deviceId: 1, requestId: 6 }),
        expect.objectContaining({ deviceId: 2, requestId: 7 }),
      ]),
    )
    expect(body.wrappedKeys).toHaveLength(2)
  })
})

// Matan's Sibling review, carried-over non-blocking note: getMyDeviceStatus
// used to always return the account's most-recently-created Device row —
// an account polling from two different devices could see the wrong one's
// status. Now scoped by this browser's own saved deviceId when available.
describe('getMyDeviceStatus', () => {
  it('scopes the poll by this device\'s own saved deviceId when one exists', async () => {
    mockLoadDeviceId.mockResolvedValue(42)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ device: { id: 42, status: 'APPROVED' } }) })

    const device = await getMyDeviceStatus()

    expect(fetch).toHaveBeenCalledWith('/api/devices/my-status?deviceId=42')
    expect(device).toEqual({ id: 42, status: 'APPROVED' })
  })

  it('falls back to no query param when this device has no saved deviceId yet', async () => {
    mockLoadDeviceId.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ device: null }) })

    await getMyDeviceStatus()

    expect(fetch).toHaveBeenCalledWith('/api/devices/my-status')
  })
})
