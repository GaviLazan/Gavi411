// Gavi411 — Express entry point (G411-11)

import express from 'express'
import 'dotenv/config'
import requestsRouter from './routes/requests.js'
import invitesRouter from './routes/invites.js'
import devicesRouter from './routes/devices.js'
import pushSubscriptionsRouter from './routes/pushSubscriptions.js'
import cors from 'cors'
import { clerkMiddleware, requireAuth } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Smoke-test route for G411-13's falsifier — not a real feature route.
// Confirms requireAuth actually rejects unauthenticated requests and
// attaches req.user for authenticated ones.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/me/public-key — uploads this user's E2E messaging public key
// (G411-82). Called once, right after the device generates its keypair
// (signup handoff — see client/src/App.jsx — or the one-off admin
// bootstrap in InviteAdmin.jsx). Overwrite-safe: re-running it (a second
// device, a lost-key recovery) just replaces the stored key, same as any
// other "this device is now the source of truth" operation in this app.
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
