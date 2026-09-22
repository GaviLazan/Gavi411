// Separate file from webPush.test.js: needs a fresh module instance for VAPID config testing.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}))

vi.mock('./prisma.js', () => ({
  prisma: {
    pushSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { create: vi.fn().mockResolvedValue({ id: 1 }) },
  },
}))

describe('sendPushToUser with missing VAPID config', () => {
  beforeEach(() => {
    delete process.env.VAPID_SUBJECT
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    vi.resetModules()
  })

  it('throws a clear error instead of an opaque one from inside web-push', async () => {
    const { sendPushToUser } = await import('./webPush.js')
    await expect(sendPushToUser('user_1', { title: 't', body: 'b' })).rejects.toThrow(
      /Web Push is misconfigured/,
    )
  })

  it('still logs the notification even though VAPID is misconfigured', async () => {
    const { sendPushToUser } = await import('./webPush.js')
    const { prisma } = await import('./prisma.js')
    await sendPushToUser('user_1', { title: 't', body: 'b' }).catch(() => {})
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'user_1', title: 't', body: 'b', requestId: null },
    })
  })
})
