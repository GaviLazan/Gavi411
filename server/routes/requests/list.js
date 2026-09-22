import express from 'express'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../middleware/auth.js'
import { MESSAGE_INCLUDE } from '../../lib/autoClose.js'

const router = express.Router()

// admin-only opt-in to get every request's messages, so admin panel can build
// client-side search index in one call instead of N follow-up GET /:id calls
const LAST_MESSAGE_ONLY_INCLUDE = {
  message: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, content: true, userId: true } },
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN'
    const where = isAdmin ? {} : { userId: req.user.clerkId }
    const includeMessages = isAdmin && req.query.include === 'messages'

    const requests = await prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...(isAdmin && { user: { select: { firstName: true, lastName: true, profilePic: true } } }),
        ...(includeMessages ? MESSAGE_INCLUDE : LAST_MESSAGE_ONLY_INCLUDE),
      },
    })

    res.json(requests)
  } catch (err) {
    console.error('Failed to load requests:', err)
    res.status(500).json({ error: 'Failed to load requests' })
  }
})

export default router
