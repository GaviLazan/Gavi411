// Tests for sendPushToUser (G411-29) — the two real behaviors worth
// covering: a 410/404 delivery failure deletes the stale subscription, and
// one subscription's failure never blocks delivery to the user's other
// subscriptions.

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
