// Route tests for notification history. Same mocking pattern
// as devices.test.js/requests.test.js — mocks Prisma and auth, no real DB.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const USER = 'user_regular'
const ADMIN = 'user_admin'

const usersByClerkId = {
  [USER]: { clerkId: USER, role: 'USER' },
  [ADMIN]: { clerkId: ADMIN, role: 'ADMIN' },
}

let currentUserId = null

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' })
    req.user = usersByClerkId[currentUserId]
    next()
  },
}))

const prismaMock = {
  notification: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
}

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }))

const { default: notificationsRouter } = await import('./notifications.js')

const app = express()
app.use(express.json())
app.use('/api/notifications', notificationsRouter)

beforeEach(() => {
  currentUserId = null
  vi.clearAllMocks()
})

describe('GET /api/notifications', () => {
  it('401s when signed out', async () => {
    const res = await request(app).get('/api/notifications')
    expect(res.status).toBe(401)
  })

  it('returns the signed-in user\'s own notifications in desc order', async () => {
    currentUserId = USER
    const now = new Date()
    const notifications = [
      { id: 3, userId: USER, title: 'Title 3', body: 'Body 3', createdAt: new Date(now.getTime() + 2000), readAt: null },
      { id: 2, userId: USER, title: 'Title 2', body: 'Body 2', createdAt: new Date(now.getTime() + 1000), readAt: now },
      { id: 1, userId: USER, title: 'Title 1', body: 'Body 1', createdAt: now, readAt: null },
    ]
    prismaMock.notification.findMany.mockResolvedValue(notifications)

    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    // Dates are serialized to ISO strings by JSON, so check structure rather than exact equality
    expect(res.body).toHaveLength(3)
    expect(res.body[0]).toMatchObject({ id: 3, userId: USER, title: 'Title 3', body: 'Body 3' })
    expect(res.body[1]).toMatchObject({ id: 2, userId: USER, title: 'Title 2', body: 'Body 2' })
    expect(res.body[2]).toMatchObject({ id: 1, userId: USER, title: 'Title 1', body: 'Body 1' })
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { userId: USER, clearedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('returns only the signed-in user\'s own rows, never another user\'s', async () => {
    currentUserId = USER
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 1, userId: USER, title: 'My notif', body: 'Body', createdAt: new Date(), readAt: null },
    ])

    await request(app).get('/api/notifications')

    // Verify the query was scoped by userId
    const call = prismaMock.notification.findMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
  })
})

describe('GET /api/notifications/unread-count', () => {
  it('401s when signed out', async () => {
    const res = await request(app).get('/api/notifications/unread-count')
    expect(res.status).toBe(401)
  })

  it('returns count of unread notifications for the signed-in user', async () => {
    currentUserId = USER
    prismaMock.notification.count.mockResolvedValue(3)

    const res = await request(app).get('/api/notifications/unread-count')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ count: 3 })
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: {
        userId: USER,
        readAt: null,
        clearedAt: null,
      },
    })
  })

  it('reflects readAt state correctly (0 unread when all read)', async () => {
    currentUserId = USER
    prismaMock.notification.count.mockResolvedValue(0)

    const res = await request(app).get('/api/notifications/unread-count')

    expect(res.body).toEqual({ count: 0 })
  })

  it('only counts the signed-in user\'s own unread rows', async () => {
    currentUserId = USER
    prismaMock.notification.count.mockResolvedValue(1)

    await request(app).get('/api/notifications/unread-count')

    const call = prismaMock.notification.count.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.readAt).toBe(null)
  })
})

describe('POST /api/notifications/mark-all-read', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/notifications/mark-all-read')
    expect(res.status).toBe(401)
  })

  it('marks all unread notifications as read for the signed-in user', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 2 })

    const res = await request(app).post('/api/notifications/mark-all-read')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          readAt: null,
        },
        data: expect.objectContaining({
          readAt: expect.any(Date),
        }),
      }),
    )
  })

  it('only touches the signed-in user\'s own unread rows', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await request(app).post('/api/notifications/mark-all-read')

    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.readAt).toBe(null)
  })

  it('cannot mark another user\'s notifications as read', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    // Send the request as USER
    await request(app).post('/api/notifications/mark-all-read')

    // Verify query was scoped by USER, not ADMIN
    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.userId).not.toBe(ADMIN)
  })
})

describe('PATCH /api/notifications/:id/mark-unread', () => {
  it('401s when signed out', async () => {
    const res = await request(app).patch('/api/notifications/1/mark-unread')
    expect(res.status).toBe(401)
  })

  it('400s on a non-integer id', async () => {
    currentUserId = USER
    const res = await request(app).patch('/api/notifications/not-a-number/mark-unread')
    expect(res.status).toBe(400)
  })

  it('sets readAt to null, scoped to the signed-in user and that row id', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app).patch('/api/notifications/7/mark-unread')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 7, userId: USER },
      data: { readAt: null },
    })
  })

  it('cannot unmark another user\'s notification (scoped by userId, not just id)', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await request(app).patch('/api/notifications/7/mark-unread')

    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.userId).not.toBe(ADMIN)
  })
})

describe('PATCH /api/notifications/:id/mark-read', () => {
  it('401s when signed out', async () => {
    const res = await request(app).patch('/api/notifications/1/mark-read')
    expect(res.status).toBe(401)
  })

  it('400s on a non-integer id', async () => {
    currentUserId = USER
    const res = await request(app).patch('/api/notifications/not-a-number/mark-read')
    expect(res.status).toBe(400)
  })

  it('sets readAt to a real date, scoped to the signed-in user and that row id', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app).patch('/api/notifications/7/mark-read')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 7, userId: USER },
      data: { readAt: expect.any(Date) },
    })
  })

  it('cannot mark another user\'s notification as read (scoped by userId, not just id)', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await request(app).patch('/api/notifications/7/mark-read')

    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.userId).not.toBe(ADMIN)
  })
})

describe('POST /api/notifications/clear-all', () => {
  it('401s when signed out', async () => {
    const res = await request(app).post('/api/notifications/clear-all')
    expect(res.status).toBe(401)
  })

  it('sets clearedAt to now for all uncleared notifications for the signed-in user', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 })

    const res = await request(app).post('/api/notifications/clear-all')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          clearedAt: null,
        },
        data: expect.objectContaining({
          clearedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('only clears the signed-in user\'s own uncleared rows', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await request(app).post('/api/notifications/clear-all')

    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.clearedAt).toBe(null)
  })

  it('cannot clear another user\'s notifications (scoped by userId)', async () => {
    currentUserId = USER
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await request(app).post('/api/notifications/clear-all')

    const call = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe(USER)
    expect(call.where.userId).not.toBe(ADMIN)
  })
})

describe('GET /api/notifications excludes cleared', () => {
  it('does not return cleared notifications (clearedAt is set)', async () => {
    currentUserId = USER
    const now = new Date()
    const notifications = [
      { id: 1, userId: USER, title: 'Not cleared', body: 'Body', createdAt: now, readAt: null, clearedAt: null },
      { id: 2, userId: USER, title: 'Cleared', body: 'Body', createdAt: now, readAt: null, clearedAt: now },
    ]
    prismaMock.notification.findMany.mockResolvedValue([notifications[0]])

    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(1)
    // Verify the query filters out cleared
    const call = prismaMock.notification.findMany.mock.calls[0][0]
    expect(call.where.clearedAt).toBe(null)
  })
})

describe('GET /api/notifications/unread-count excludes cleared', () => {
  it('does not count cleared notifications toward unread count', async () => {
    currentUserId = USER
    prismaMock.notification.count.mockResolvedValue(1)

    const res = await request(app).get('/api/notifications/unread-count')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ count: 1 })
    // Verify the query filters out cleared
    const call = prismaMock.notification.count.mock.calls[0][0]
    expect(call.where.clearedAt).toBe(null)
    expect(call.where.readAt).toBe(null)
  })
})
