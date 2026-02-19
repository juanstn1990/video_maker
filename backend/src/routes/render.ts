import { Router, Request, Response } from 'express'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { VideoConfig } from '../types/video'

export const RENDERS_DIR = '/tmp/vm_renders'
fs.mkdirSync(RENDERS_DIR, { recursive: true })

interface Job {
  status: 'queued' | 'bundling' | 'rendering' | 'completed' | 'error' | 'cancelled'
  progress: number
  message: string
  outputFile?: string
  error?: string
  cancelled?: boolean
}

export const jobs = new Map<string, Job>()

let bundleCache: string | null = null
// Track the entry point mtime to auto-invalidate the bundle when source changes
let bundleMtime = 0

async function getBundle(): Promise<string> {
  const entryPoint = path.resolve(__dirname, '../../../frontend/src/remotion/Root.tsx')
  // Invalidate cache if the remotion source directory has changed
  const srcDir = path.resolve(__dirname, '../../../frontend/src/remotion')
  const latestMtime = getLatestMtime(srcDir)
  if (bundleCache && latestMtime <= bundleMtime) return bundleCache
  bundleMtime = latestMtime
  bundleCache = await bundle({ entryPoint })
  return bundleCache
}

function getLatestMtime(dir: string): number {
  let latest = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        latest = Math.max(latest, getLatestMtime(full))
      } else {
        latest = Math.max(latest, fs.statSync(full).mtimeMs)
      }
    }
  } catch {}
  return latest
}

export const renderRouter = Router()

renderRouter.post('/render', async (req: Request, res: Response) => {
  const { config, fastMode } = req.body as { config: VideoConfig; fastMode?: boolean }
  if (!config) {
    res.status(400).json({ error: 'Se requiere una configuración de video' })
    return
  }

  const jobId = uuidv4()
  jobs.set(jobId, { status: 'queued', progress: 0, message: 'En cola...' })
  res.json({ jobId })

  // Run render in background
  runRender(jobId, config, fastMode ?? false).catch((err) => {
    console.error('Render error:', err)
    // Inner runRender already updates the job; this is a safety net
    const existing = jobs.get(jobId)
    if (existing && existing.status !== 'error') {
      jobs.set(jobId, { status: 'error', progress: 0, message: String(err), error: String(err) })
    }
  })
})

renderRouter.get('/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)

  if (!job) {
    res.status(404).json({ error: 'Job no encontrado' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = () => {
    const j = jobs.get(jobId)
    if (!j) {
      res.write(`data: ${JSON.stringify({ status: 'not_found', progress: 0, message: 'No encontrado' })}\n\n`)
      clearInterval(interval)
      res.end()
      return
    }
    res.write(`data: ${JSON.stringify({ status: j.status, progress: j.progress, message: j.message })}\n\n`)
    if (['completed', 'error', 'cancelled'].includes(j.status)) {
      clearInterval(interval)
      res.end()
    }
  }

  send()
  const interval = setInterval(send, 500)
  req.on('close', () => clearInterval(interval))
})

// Rewrite relative /uploads/ paths to absolute URLs so Remotion's
// headless Chromium can fetch media from the Express backend.
const BACKEND_PORT = Number(process.env.PORT) || 3001
function rewriteMediaUrls(config: VideoConfig): VideoConfig {
  return JSON.parse(
    JSON.stringify(config).replace(/\/uploads\//g, `http://localhost:${BACKEND_PORT}/uploads/`),
  ) as VideoConfig
}

async function runRender(jobId: string, config: VideoConfig, fastMode: boolean) {
  const job = jobs.get(jobId)!

  try {
    job.status = 'bundling'
    job.progress = 5
    job.message = 'Preparando el proyecto...'

    const serveUrl = await getBundle()

    const job2 = jobs.get(jobId)!
    if (job2.cancelled) { job2.status = 'cancelled'; job2.message = 'Cancelado'; return }

    job2.status = 'rendering'
    job2.progress = 10
    job2.message = 'Iniciando renderizado...'

    const renderConfig = rewriteMediaUrls(config)
    const outputFile = path.join(RENDERS_DIR, `${jobId}.mp4`)

    const composition = await selectComposition({
      serveUrl,
      id: 'VideoSlideshow',
      inputProps: { config: renderConfig },
    })

    const cpuCount = require('os').cpus().length
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputFile,
      inputProps: { config: renderConfig },
      concurrency: Math.max(4, cpuCount - 1),
      imageFormat: 'jpeg',
      jpegQuality: fastMode ? 70 : 85,
      crf: fastMode ? 28 : 18,
      scale: fastMode ? 0.5 : 1,
      onProgress: ({ progress }) => {
        const j = jobs.get(jobId)!
        if (j.cancelled) return
        j.progress = 10 + Math.round(progress * 85)
        j.message = `Renderizando... ${Math.round(progress * 100)}%`
      },
      // Use system Chromium in Docker (set CHROME_PATH env var); falls back to bundled one in dev
      browserExecutable: process.env.CHROME_PATH || undefined,
      chromiumOptions: { disableWebSecurity: true },
    })

    const j = jobs.get(jobId)!
    if (j.cancelled) {
      fs.existsSync(outputFile) && fs.unlinkSync(outputFile)
      j.status = 'cancelled'
      j.message = 'Cancelado'
      return
    }

    j.status = 'completed'
    j.progress = 100
    j.message = 'Video listo'
    j.outputFile = outputFile
  } catch (err) {
    const j = jobs.get(jobId)!
    j.status = 'error'
    j.message = `Error: ${err}`
    j.error = String(err)
    throw err
  }
}
