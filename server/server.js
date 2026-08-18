// Gavi411 — Express entry point (G411-11)

import express from 'express'
import 'dotenv/config'
import requestsRouter from './routes/requests.js'
import cors from 'cors'

const app = express()

app.use(express.json())
app.use(cors())

app.use('/api/requests', requestsRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
