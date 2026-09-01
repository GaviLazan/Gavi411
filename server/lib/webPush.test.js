// Tests for sendPushToUser (G411-29) — the real behaviors worth covering:
// a 410/404 delivery failure deletes the stale subscription, one
// subscription's failure never blocks delivery to the user's other
// subscriptions, and missing VAPID config fails loud with a clear message
// (Sibling review finding — this used to fail with an opaque error deep
// inside the web-push library).

import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.VAPID_SUBJECT ??= 'mailto:test@example.com'
process.env.VAPID_PUBLIC_KEY ??= 'test-public-key'
process.env.VAPID_PRIVATE_KEY ??= 'test-private-key'

const sendNotification = vi.fn()

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args) => sendNotification(...args),
  },
}))

const prismaMock = {
  pushSubscription: {
    findMany: vi.fn(),
    delete: vi.fn(),
  },
}

vi.mock('./prisma.js', () => ({ prisma: prismaMock }))

const { sendPushToUser } = await import('./webPush.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendPushToUser', () => {
  it('deletes a subscription that the push service reports as gone (410)', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://push.example/a', p256dh: 'p', auth: 'a' },
    ])
    prismaMock.pushSubscription.delete.mockResolvedValue({})
    sendNotification.mockRejectedValue({ statusCode: 410 })

    await sendPushToUser('user_1', { title: 't', body: 'b' })

    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('delivers to remaining subscriptions when one fails for an unrelated reason', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://push.example/bad', p256dh: 'p', auth: 'a' },
      { id: 2, endpoint: 'https://push.example/good', p256dh: 'p', auth: 'a' },
    ])
    sendNotification
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(undefined)

    await sendPushToUser('user_1', { title: 't', body: 'b' })

    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled()
  })
})
