import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
// Load .env from project root (one level above /backend)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
import express from 'express'
import cors from 'cors'
import { uploadRouter, UPLOADS_DIR } from './routes/upload'
import { renderRouter } from './routes/render'
import { jobsRouter } from './routes/jobs'
import { transcribeRouter } from './routes/transcribe'
import { watermarkRouter } from './routes/watermark'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve uploaded media files as static
app.use('/uploads', express.static(UPLOADS_DIR))

// Routes
app.use('/api', uploadRouter)
app.use('/api', renderRouter)
app.use('/api', jobsRouter)
app.use('/api', transcribeRouter)
app.use('/api', watermarkRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve built frontend (production / Docker)
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`)
})
