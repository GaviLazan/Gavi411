// Gavi411 — Express entry point (G411-11)

import express from 'express'
import 'dotenv/config'
import requestsRouter from './routes/requests.js'
import invitesRouter from './routes/invites.js'
import cors from 'cors'
import { clerkMiddleware, requireAuth } from './middleware/auth.js'

const app = express()

app.use(express.json())
app.use(cors())

// Reads the session on every request (cookie or Authorization: Bearer
// <token>) and populates req.auth if present. Does not reject anyone by
// itself — routes opt into protection with requireAuth (see auth.js).
app.use(clerkMiddleware())

app.use('/api/requests', requestsRouter)
app.use('/api/invites', invitesRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Smoke-test route for G411-13's falsifier — not a real feature route.
// Confirms requireAuth actually rejects unauthenticated requests and
// attaches req.user for authenticated ones.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
