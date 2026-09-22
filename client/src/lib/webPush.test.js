// Tests for subscribeToPush: VAPID validation and server POST rollback on failure.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function stubPushSupport({ subscribeImpl } = {}) {
  const unsubscribe = vi.fn().mockResolvedValue(true)
  const subscription = {
    toJSON: () => ({ endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe,
  }
  const subscribe = subscribeImpl || vi.fn().mockResolvedValue(subscription)

  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
  })
  vi.stubGlobal('window', { PushManager: {} })
  vi.stubGlobal('atob', (s) => Buffer.from(s, 'base64').toString('binary'))

  return { subscribe, unsubscribe, subscription }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('subscribeToPush', () => {
  it('throws a clear error when VITE_VAPID_PUBLIC_KEY is unset', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    stubPushSupport()
    const { subscribeToPush } = await import('./webPush.js')

    await expect(subscribeToPush()).rejects.toThrow(/VITE_VAPID_PUBLIC_KEY/)
  })

  it('rolls back the browser subscription if the server POST fails', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AAAA')
    const { unsubscribe } = stubPushSupport()
    fetch.mockResolvedValue({ ok: false, status: 500 })
    const { subscribeToPush } = await import('./webPush.js')

    await expect(subscribeToPush()).rejects.toThrow(/Failed to register/)
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('returns the subscription when the server POST succeeds', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AAAA')
    const { unsubscribe, subscription } = stubPushSupport()
    fetch.mockResolvedValue({ ok: true })
    const { subscribeToPush } = await import('./webPush.js')

    const result = await subscribeToPush()

    expect(result).toBe(subscription)
    expect(unsubscribe).not.toHaveBeenCalled()
  })
})
