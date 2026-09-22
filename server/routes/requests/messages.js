import express from 'express'
import multer from 'multer'
import { Status } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../middleware/auth.js'
import { canAccessRequest } from '../../lib/requestAccess.js'
import { E2E_ENABLED } from '../../lib/e2eConfig.js'
import { validateImage, uploadImage, MAX_IMAGE_BYTES } from '../../lib/cloudinary.js'
import { deductCredit } from '../../lib/credits.js'
import { notifyAdmins, notifyUser } from '../../lib/notify.js'
import { buildPermalink } from './buildPermalink.js'

const router = express.Router()

// memoryStorage — files stay in RAM as a Buffer just long enough to forward to Cloudinary
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } })

// Wraps upload.single to return JSON error shape instead of HTML error page
function uploadImageField(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image too large (10MB max)' })
    }
    console.error('Image upload middleware error:', err)
    res.status(400).json({ error: 'Invalid image upload' })
  })
}

// POST /:id/messages — append a message to a request's thread
router.post('/:id/messages', requireAuth, uploadImageField, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid request id' })
  }

  const { content, encrypted } = req.body
  const hasText = content && content.trim()
  const hasImage = Boolean(req.file)
  if (!hasText && !hasImage) {
    return res.status(400).json({ error: 'content or an image is required' })
  }

  if (hasImage) {
    const validationError = validateImage(req.file)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }
  }

  try {
    const existing = await prisma.request.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' })
    }
    if (!canAccessRequest(existing, req.user)) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // E2E disabled: force plaintext until re-enabled
    const isEncrypted = E2E_ENABLED && (encrypted === true || encrypted === 'true')
    if (isEncrypted && !req.user.publicKey) {
      return res.status(400).json({ error: 'Your device has no encryption key on file yet' })
    }

    let imageUrl = null
    if (hasImage) {
      const uploaded = await uploadImage(req.file.buffer)
      imageUrl = uploaded.secure_url
    }

    const messageData = {
      content: hasText ? content : '',
      encrypted: isEncrypted,
      imageUrl,
      requestId: id,
      userId: req.user.clerkId,
    }

    const REOPENABLE_STATUSES = [Status.CLOSED, Status.CANCELLED, Status.SELF_SOLVED]
    let message
    if (REOPENABLE_STATUSES.includes(existing.status)) {
      const reopenTarget = req.user.role === 'ADMIN' ? Status.WAITING_ON_USER : Status.IN_QUEUE
      message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({ data: messageData })
        const fresh = await tx.request.findUnique({
          where: { id },
          select: { status: true, refundedAt: true },
        })
        if (REOPENABLE_STATUSES.includes(fresh.status)) {
          const updateData = { status: reopenTarget }
          if (fresh.refundedAt !== null) {
            await deductCredit(tx, existing.userId)
            updateData.refundedAt = null
          }
          if (req.user.role !== 'ADMIN') {
            updateData.nudgedAt = null
            updateData.nudgeTwoSentAt = null
          }
          await tx.request.update({ where: { id }, data: updateData })
        }
        return created
      })
    } else {
      message = await prisma.message.create({ data: messageData })
      if (req.user.role !== 'ADMIN') {
        await prisma.request.update({
          where: { id },
          data: { nudgedAt: null, nudgeTwoSentAt: null },
        })
      }
    }

    // Notify on new message
    if (req.user.role !== 'ADMIN') {
      // Friend sending a message — notify admin
      notifyAdmins(
        {
          title: `New message from ${req.user.firstName} ${req.user.lastName}`,
          body: `in ${existing.freeText}`,
          link: buildPermalink(existing.publicId),
          requestId: existing.id,
        },
        { telegram: true, excludeClerkId: req.user.clerkId },
      ).catch((err) => {
        console.error('Failed to notify admins of new message:', err)
      })
    } else {
      // Admin sending a message — notify the friend
      notifyUser(
        existing.userId,
        {
          title: 'New message',
          body: 'Gavi sent you a new message',
          requestId: existing.id,
        },
        { excludeClerkId: req.user.clerkId },
      ).catch((err) => {
        console.error('Failed to notify user of new message:', err)
      })
    }

    res.status(201).json(message)
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    console.error('Failed to create message:', err)
    res.status(500).json({ error: 'Failed to create message' })
  }
})

export default router
