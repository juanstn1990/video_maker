import { Router, Request, Response } from 'express'
import fs from 'fs'
import { jobs } from './render'

export const jobsRouter = Router()

jobsRouter.get('/jobs/:jobId', (req: Request, res: Response) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job no encontrado' })
    return
  }
  res.json({ status: job.status, progress: job.progress, message: job.message })
})

jobsRouter.post('/cancel/:jobId', (req: Request, res: Response) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job no encontrado' })
    return
  }
  if (!['queued', 'bundling', 'rendering'].includes(job.status)) {
    res.status(400).json({ error: 'El job no se puede cancelar', status: job.status })
    return
  }
  job.cancelled = true
  res.json({ success: true })
})

jobsRouter.get('/download/:jobId', (req: Request, res: Response) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job no encontrado' })
    return
  }
  if (job.status !== 'completed' || !job.outputFile) {
    res.status(400).json({ error: 'Video no disponible' })
    return
  }
  res.download(job.outputFile, 'video_generado.mp4')
})
