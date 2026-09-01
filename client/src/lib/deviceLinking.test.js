// G411-28 device-linking orchestration. Matan's Sibling review (PR #35)
// explicitly flagged this file as untested — "no tests exist for
// deviceLinking.js or the new conversationCrypto.js path, exactly where
// the two High findings live." Same convention as conversationCrypto.test.js:
// real Web Crypto, mocked fetch + keyStore.js (browser-only, untested by
// design).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeypair, exportPublicKey } from './crypto.js'

vi.mock('./keyStore.js', () => ({
  savePrivateKey: vi.fn(),
  saveDeviceId: vi.fn(),
  loadDeviceId: vi.fn(),
  loadPrivateKey: vi.fn(),
}))

const { approveDevice, wrapMissingConversationKeys } = await import('./deviceLinking.js')

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
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
})
