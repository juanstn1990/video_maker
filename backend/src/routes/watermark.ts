import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { UPLOADS_DIR } from './upload'

const router = Router()

const WATERMARK_FILE = path.resolve(__dirname, '../../assets/marca_agua.mp3')

const wmStorage = multer.diskStorage({
  destination: path.join(UPLOADS_DIR, 'wm_tmp'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

fs.mkdirSync(path.join(UPLOADS_DIR, 'wm_tmp'), { recursive: true })

const upload = multer({ storage: wmStorage, limits: { fileSize: 200 * 1024 * 1024 } })

interface WatermarkJob {
  status: 'processing' | 'done' | 'error'
  progress: number
  message: string
  outputPath?: string
  outputName?: string
}

const jobs: Record<string, WatermarkJob> = {}

router.post('/watermark', upload.single('audio'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo de audio' })
    return
  }

  if (!fs.existsSync(WATERMARK_FILE)) {
    res.status(500).json({ error: 'Archivo marca_agua.mp3 no encontrado en el servidor' })
    return
  }

  const interval = Math.max(1, parseInt(req.body.interval ?? '8', 10))
  const volume = Math.max(0.01, parseFloat(req.body.volume ?? '1.2'))
  const preview = req.body.mode === 'preview'

  const jobId = uuidv4()
  const jobDir = path.join(UPLOADS_DIR, `wm_${jobId}`)
  fs.mkdirSync(jobDir, { recursive: true })

  const originalName = req.file.originalname || 'audio.mp3'
  const ext = path.extname(originalName) || '.mp3'
  const inputPath = path.join(jobDir, `input${ext}`)
  const outputName = `watermarked_${originalName}`
  const outputPath = path.join(jobDir, outputName)

  fs.renameSync(req.file.path, inputPath)

  jobs[jobId] = { status: 'processing', progress: 10, message: 'Iniciando...' }

  processWatermark(jobId, inputPath, outputPath, outputName, interval, volume, preview)

  res.json({ job_id: jobId })
})

function processWatermark(
  jobId: string,
  inputPath: string,
  outputPath: string,
  outputName: string,
  interval: number,
  volume: number,
  preview: boolean,
) {
  jobs[jobId].message = 'Obteniendo duración del audio...'
  jobs[jobId].progress = 15

  // Get audio duration via ffprobe
  execFile(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath],
    (err, stdout) => {
      if (err) {
        jobs[jobId] = { status: 'error', progress: 0, message: `Error leyendo audio: ${err.message}` }
        return
      }

      const duration = parseFloat(stdout.trim())
      if (isNaN(duration)) {
        jobs[jobId] = { status: 'error', progress: 0, message: 'No se pudo determinar la duración del audio' }
        return
      }

      jobs[jobId].message = 'Mezclando marca de agua...'
      jobs[jobId].progress = 30

      const effectiveDuration = preview ? Math.min(duration, 60) : duration
      const numWatermarks = Math.max(1, Math.floor(effectiveDuration / interval))

      // Build ffmpeg filter_complex:
      // Input 0: main song, Input 1: watermark file
      // Delay each watermark copy to its interval position, then amix everything
      const filterParts: string[] = []
      const mixInputs: string[] = ['[0:a]']

      for (let i = 0; i < numWatermarks; i++) {
        const delayMs = i * interval * 1000
        filterParts.push(`[1:a]adelay=${delayMs}|${delayMs},volume=${volume}[wm${i}]`)
        mixInputs.push(`[wm${i}]`)
      }

      filterParts.push(
        `${mixInputs.join('')}amix=inputs=${numWatermarks + 1}:duration=first:normalize=0[out]`,
      )

      const filterComplex = filterParts.join(';')

      execFile(
        'ffmpeg',
        [
          '-i', inputPath,
          '-i', WATERMARK_FILE,
          '-filter_complex', filterComplex,
          '-map', '[out]',
          ...(preview ? ['-t', '60'] : []),
          '-c:a', 'libmp3lame',
          '-q:a', '2',
          '-y',
          outputPath,
        ],
        (ffErr) => {
          if (ffErr) {
            jobs[jobId] = { status: 'error', progress: 0, message: `Error en ffmpeg: ${ffErr.message}` }
            return
          }

          jobs[jobId] = { status: 'done', progress: 100, message: 'Listo', outputPath, outputName }
        },
      )
    },
  )
}

router.get('/watermark/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job) {
    res.status(404).json({ error: 'Trabajo no encontrado' })
    return
  }
  const { outputPath: _out, ...safe } = job
  res.json(safe)
})

router.get('/watermark/download/:jobId', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job || job.status !== 'done' || !job.outputPath) {
    res.status(404).json({ error: 'Archivo no disponible' })
    return
  }
  res.download(job.outputPath, job.outputName ?? 'watermarked.mp3')
})

export { router as watermarkRouter }
