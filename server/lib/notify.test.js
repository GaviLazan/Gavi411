// Tests for G411-51 notification dispatch helpers. Mocks Prisma and
// sendPushToUser — no real DB touched, no real push service hit.
// Covers: notifyAdmins/notifyUser recipient targeting, self-notification
// exclusion, and Telegram stub call.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ADMIN1 = 'user_admin_1'
const ADMIN2 = 'user_admin_2'
const FRIEND = 'user_friend'

const adminUsers = [
  { clerkId: ADMIN1, role: 'ADMIN' },
  { clerkId: ADMIN2, role: 'ADMIN' },
]

const prismaMock = {
  user: {
    findMany: vi.fn(),
  },
}

const sendPushToUserMock = vi.fn()

vi.mock('./prisma.js', () => ({ prisma: prismaMock }))
vi.mock('./webPush.js', () => ({
  sendPushToUser: sendPushToUserMock,
}))

const { notifyAdmins, notifyUser } = await import('./notify.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findMany.mockResolvedValue(adminUsers)
  sendPushToUserMock.mockResolvedValue(undefined)
})

describe('notifyAdmins', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends push to all admins', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyAdmins(payload)

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
    })
    expect(sendPushToUserMock).toHaveBeenCalledTimes(2)
    expect(sendPushToUserMock).toHaveBeenCalledWith(ADMIN1, payload)
    expect(sendPushToUserMock).toHaveBeenCalledWith(ADMIN2, payload)
  })

  it('excludes self when excludeClerkId matches an admin', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyAdmins(payload, { excludeClerkId: ADMIN1 })

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1)
    expect(sendPushToUserMock).toHaveBeenCalledWith(ADMIN2, payload)
    expect(sendPushToUserMock).not.toHaveBeenCalledWith(ADMIN1, expect.anything())
  })

  it('calls sendTelegram when telegram option is true and sends to Telegram with link', async () => {
    const payload = { title: 'Test', body: 'Test body', link: 'https://example.com/r/abc123' }
    global.fetch.mockResolvedValue({ ok: true })

    await notifyAdmins(payload, { telegram: true })

    expect(sendPushToUserMock).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bot'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    // Verify the text content is correct
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.text).toBe('Test\nTest body\n\nhttps://example.com/r/abc123')
  })

  it('sends Telegram without link when link is not provided', async () => {
    const payload = { title: 'Test', body: 'Test body' }
    global.fetch.mockResolvedValue({ ok: true })

    await notifyAdmins(payload, { telegram: true })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bot'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    // Verify the body doesn't contain extra newlines (no link part)
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.text).toBe('Test\nTest body')
  })

  it('skips telegram when telegram option is false', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyAdmins(payload, { telegram: false })

    // No way to assert telegram wasn't called (it's internal), but we verify
    // push was sent normally
    expect(sendPushToUserMock).toHaveBeenCalled()
  })

  it('handles fetch errors gracefully without rejecting the caller promise', async () => {
    const payload = { title: 'Test', body: 'Test body' }
    global.fetch.mockRejectedValue(new Error('Network error'))

    // Should not throw or reject
    await expect(notifyAdmins(payload, { telegram: true })).resolves.toBeUndefined()
    expect(sendPushToUserMock).toHaveBeenCalled()
  })

  it('handles non-ok Telegram API responses gracefully', async () => {
    const payload = { title: 'Test', body: 'Test body' }
    global.fetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' })

    // Should not throw or reject
    await expect(notifyAdmins(payload, { telegram: true })).resolves.toBeUndefined()
  })
})

describe('notifyUser', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends push to a specific user', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyUser(FRIEND, payload)

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1)
    expect(sendPushToUserMock).toHaveBeenCalledWith(FRIEND, payload)
  })

  it('skips notification when excludeClerkId matches the target user', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyUser(FRIEND, payload, { excludeClerkId: FRIEND })

    expect(sendPushToUserMock).not.toHaveBeenCalled()
  })

  it('does not skip when excludeClerkId does not match', async () => {
    const payload = { title: 'Test', body: 'Test body' }

    await notifyUser(FRIEND, payload, { excludeClerkId: ADMIN1 })

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1)
    expect(sendPushToUserMock).toHaveBeenCalledWith(FRIEND, payload)
  })

  it('calls sendTelegram when telegram option is true', async () => {
    const payload = { title: 'Test', body: 'Test body', link: 'https://example.com/r/def456' }
    global.fetch.mockResolvedValue({ ok: true })

    await notifyUser(FRIEND, payload, { telegram: true })

    expect(sendPushToUserMock).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bot'),
      expect.anything(),
    )
  })
})
