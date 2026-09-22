// Gavi411 — Express entry point (G411-11)

import express from 'express'
import 'dotenv/config'
import requestsRouter from './routes/requests/index.js'
import invitesRouter from './routes/invites.js'
import devicesRouter from './routes/devices.js'
import pushSubscriptionsRouter from './routes/pushSubscriptions.js'
import triggersRouter from './routes/triggers.js'
import presenceRouter from './routes/presence.js'
import completeProfileRouter from './routes/completeProfile.js'
import notificationsRouter from './routes/notifications.js'
import cors from 'cors'
import { clerkMiddleware, requireAuth } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'
import { runAutoCloseCheck } from './lib/autoClose.js'
import { resetMonthlyCredits } from './lib/credits.js'

const app = express()

app.use(express.json())
app.use(cors())

// Reads the session on every request (cookie or Authorization: Bearer
// <token>) and populates req.auth if present. Does not reject anyone by
// itself — routes opt into protection with requireAuth (see auth.js).
app.use(clerkMiddleware())

app.use('/api/requests', requestsRouter)
app.use('/api/invites', invitesRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/push', pushSubscriptionsRouter)
app.use('/api/triggers', triggersRouter)
app.use('/api/presence', presenceRouter)
app.use('/api/me', completeProfileRouter)
app.use('/api/notifications', notificationsRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

app.patch('/api/me/public-key', requireAuth, async (req, res) => {
  const { publicKey } = req.body
  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: 'publicKey is required' })
  }
  const user = await prisma.user.update({
    where: { clerkId: req.user.clerkId },
    data: { publicKey },
  })
  res.json({ user })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

const AUTO_CLOSE_INTERVAL_MS = 6 * 60 * 60 * 1000
setInterval(() => {
  runAutoCloseCheck().catch((err) => console.error('Auto-close check failed:', err))
}, AUTO_CLOSE_INTERVAL_MS)

const CREDIT_RESET_INTERVAL_MS = AUTO_CLOSE_INTERVAL_MS
setInterval(() => {
  resetMonthlyCredits().catch((err) => console.error('Credit reset check failed:', err))
}, CREDIT_RESET_INTERVAL_MS)
