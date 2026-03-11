/**
 * POST /api/audio-preview
 *
 * Recibe una URL de audio, descarga el archivo, aplica la marca de agua,
 * lo corta a 60 segundos y devuelve el MP3 directamente en la respuesta.
 *
 * Body JSON:
 *   { audioUrl: string, interval?: number, volume?: number }
 *
 * Uso desde n8n: HTTP Request node → POST, Body=JSON, Response=File
 */

import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { execFile } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

const WATERMARK_FILE = path.resolve(__dirname, '../../assets/marca_agua.mp3')
const TMP_DIR = '/tmp/vm_audio_preview'
fs.mkdirSync(TMP_DIR, { recursive: true })

const PREVIEW_SECONDS = 60

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(destPath)
    proto
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          fs.unlink(destPath, () => {})
          return downloadFile(res.headers.location!, destPath).then(resolve).catch(reject)
        }
        if (res.statusCode && res.statusCode >= 400) {
          file.close()
          fs.unlink(destPath, () => {})
          return reject(new Error(`HTTP ${res.statusCode} al descargar el audio`))
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', (err) => {
          fs.unlink(destPath, () => {})
          reject(err)
        })
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
  })
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe error: ${err.message}`))
        const dur = parseFloat(stdout.trim())
        if (isNaN(dur)) return reject(new Error('No se pudo determinar la duración del audio'))
        resolve(dur)
      },
    )
  })
}

function applyWatermarkAndPreview(
  inputPath: string,
  outputPath: string,
  interval: number,
  volume: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    getAudioDuration(inputPath).then((duration) => {
      const effectiveDuration = Math.min(duration, PREVIEW_SECONDS)
      const numWatermarks = Math.max(1, Math.floor(effectiveDuration / interval))

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
          '-t', String(PREVIEW_SECONDS),
          '-c:a', 'libmp3lame',
          '-q:a', '2',
          '-y',
          outputPath,
        ],
        (err) => {
          if (err) return reject(new Error(`ffmpeg error: ${err.message}`))
          resolve()
        },
      )
    }).catch(reject)
  })
}

router.post('/audio-preview', async (req: Request, res: Response) => {
  const { audioUrl, interval, volume } = req.body as {
    audioUrl?: string
    interval?: number
    volume?: number
  }

  if (!audioUrl || typeof audioUrl !== 'string') {
    res.status(400).json({ error: 'Se requiere el campo audioUrl' })
    return
  }

  if (!fs.existsSync(WATERMARK_FILE)) {
    res.status(500).json({ error: 'Archivo marca_agua.mp3 no encontrado en el servidor' })
    return
  }

  const jobId = uuidv4()
  const jobDir = path.join(TMP_DIR, jobId)
  fs.mkdirSync(jobDir, { recursive: true })

  const inputPath = path.join(jobDir, 'input.mp3')
  const outputPath = path.join(jobDir, 'preview.mp3')

  try {
    await downloadFile(audioUrl, inputPath)

    const wmInterval = Math.max(1, Number(interval ?? 8))
    const wmVolume = Math.max(0.01, Number(volume ?? 1.2))

    await applyWatermarkAndPreview(inputPath, outputPath, wmInterval, wmVolume)

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', 'attachment; filename="preview_watermark.mp3"')

    const stream = fs.createReadStream(outputPath)
    stream.pipe(res)
    stream.on('end', () => {
      // Cleanup after sending
      fs.rm(jobDir, { recursive: true, force: true }, () => {})
    })
    stream.on('error', () => {
      fs.rm(jobDir, { recursive: true, force: true }, () => {})
    })
  } catch (err: unknown) {
    fs.rm(jobDir, { recursive: true, force: true }, () => {})
    const message = err instanceof Error ? err.message : String(err)
    if (!res.headersSent) {
      res.status(500).json({ error: message })
    }
  }
})

export { router as audioPreviewRouter }
