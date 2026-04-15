import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { pool } from '../db'

const router = Router()

// ── Token helpers ──────────────────────────────────────────────────────────
const DOWNLOAD_SECRET = process.env.DOWNLOAD_SECRET ?? 'cambia-esto-en-produccion'

function signId(id: number): string {
  const hmac = crypto
    .createHmac('sha256', DOWNLOAD_SECRET)
    .update(id.toString())
    .digest('hex')
    .slice(0, 24) // 12 bytes de entropía es suficiente
  return Buffer.from(`${id}:${hmac}`).toString('base64url')
}

function verifyToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const colonIdx = decoded.lastIndexOf(':')
    if (colonIdx === -1) return null
    const idStr = decoded.slice(0, colonIdx)
    const givenHmac = decoded.slice(colonIdx + 1)
    const id = parseInt(idStr, 10)
    if (isNaN(id)) return null
    const expected = crypto
      .createHmac('sha256', DOWNLOAD_SECRET)
      .update(id.toString())
      .digest('hex')
      .slice(0, 24)
    // timing-safe compare
    if (givenHmac.length !== expected.length) return null
    const match = crypto.timingSafeEqual(Buffer.from(givenHmac), Buffer.from(expected))
    return match ? id : null
  } catch {
    return null
  }
}

// Search records by phone or song name
router.get('/biblioteca/search', async (req, res) => {
  const q = ((req.query.q as string) ?? '').trim()

  try {
    let result
    if (!q) {
      // Return all records (latest first)
      result = await pool.query(
        `SELECT id, job_id, phone, song_name, output_filename, input_path, created_at
         FROM watermark_records
         ORDER BY created_at DESC
         LIMIT 200`,
      )
    } else {
      result = await pool.query(
        `SELECT id, job_id, phone, song_name, output_filename, input_path, created_at
         FROM watermark_records
         WHERE phone ILIKE $1 OR song_name ILIKE $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [`%${q}%`],
      )
    }
    const records = result.rows.map((r: { id: number; [key: string]: unknown }) => ({
      ...r,
      token: signId(r.id),
    }))
    res.json({ records })
  } catch (err) {
    console.error('Error en búsqueda:', err)
    res.status(500).json({ error: 'Error al buscar registros' })
  }
})

// Stream audio inline for playback (serves clean original, falls back to watermarked)
router.get('/biblioteca/stream/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID inválido' })
    return
  }

  try {
    const result = await pool.query(
      `SELECT input_path, output_path, output_filename FROM watermark_records WHERE id = $1`,
      [id],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }

    const { input_path, output_path, output_filename } = result.rows[0]
    const filePath = (input_path && fs.existsSync(input_path)) ? input_path : output_path

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(410).json({ error: 'El archivo ya no existe en el servidor' })
      return
    }

    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Accept-Ranges', 'bytes')
    // Serve with range support so the browser audio player can seek
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error al transmitir archivo' })
      }
    })
  } catch (err) {
    console.error('Error en stream:', err)
    res.status(500).json({ error: 'Error al transmitir archivo' })
  }
})

// Download original (without watermark) by signed token
router.get('/biblioteca/download/:token', async (req, res) => {
  const id = verifyToken(req.params.token)
  if (id === null) {
    res.status(400).json({ error: 'Enlace inválido o expirado' })
    return
  }

  try {
    const result = await pool.query(
      `SELECT input_path, output_path, output_filename FROM watermark_records WHERE id = $1`,
      [id],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }

    const { input_path, output_path, output_filename } = result.rows[0]

    // Prefer original clean file; fall back to watermarked for old records
    const filePath = (input_path && fs.existsSync(input_path)) ? input_path : output_path

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(410).json({ error: 'El archivo ya no existe en el servidor' })
      return
    }

    // Strip "watermarked_" prefix from download name
    const cleanFilename = output_filename.replace(/^watermarked_/, '')
    res.download(filePath, cleanFilename)
  } catch (err) {
    console.error('Error en descarga:', err)
    res.status(500).json({ error: 'Error al descargar archivo' })
  }
})

// Delete records older than 1 month and their associated files
router.delete('/biblioteca/cleanup', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, output_path FROM watermark_records WHERE created_at < NOW() - INTERVAL '1 month'`,
    )

    let deleted = 0
    let fileErrors = 0

    for (const row of result.rows) {
      try {
        const jobDir = path.dirname(row.output_path)
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true })
        }
      } catch {
        fileErrors++
      }
      await pool.query('DELETE FROM watermark_records WHERE id = $1', [row.id])
      deleted++
    }

    res.json({ deleted, fileErrors })
  } catch (err) {
    console.error('Error en limpieza:', err)
    res.status(500).json({ error: 'Error al limpiar registros' })
  }
})

// Delete a single record by id and its associated files (must be AFTER /cleanup)
router.delete('/biblioteca/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID inválido' })
    return
  }

  try {
    const result = await pool.query(
      `SELECT id, output_path FROM watermark_records WHERE id = $1`,
      [id],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }

    const { output_path } = result.rows[0]

    try {
      const jobDir = path.dirname(output_path)
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true })
      }
    } catch {
      // File removal errors are non-fatal
    }

    await pool.query('DELETE FROM watermark_records WHERE id = $1', [id])
    res.json({ deleted: 1 })
  } catch (err) {
    console.error('Error al borrar registro:', err)
    res.status(500).json({ error: 'Error al borrar el registro' })
  }
})

export { router as bibliotecaRouter }
