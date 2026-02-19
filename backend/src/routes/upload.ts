import { Router, Request, Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { UploadResponse } from '../types/api'

export const UPLOADS_DIR = '/tmp/vm_uploads'
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } })

export const uploadRouter = Router()

uploadRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'No se recibió ningún archivo' })
    return
  }

  const mediaId = path.basename(file.filename, path.extname(file.filename))
  const fileUrl = `/uploads/${file.filename}`
  const isImage = file.mimetype.startsWith('image/')
  const isAudio = file.mimetype.startsWith('audio/')

  try {
    if (isImage) {
      // Generate thumbnail
      const thumbFilename = `${mediaId}_thumb.jpg`
      const thumbPath = path.join(UPLOADS_DIR, thumbFilename)
      const meta = await sharp(file.path)
        .resize(200, 200, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)

      const full = await sharp(file.path).metadata()

      const response: UploadResponse = {
        mediaId,
        filename: file.originalname,
        url: fileUrl,
        type: 'image',
        width: full.width,
        height: full.height,
        thumbnailUrl: `/uploads/${thumbFilename}`,
      }
      res.json(response)
    } else if (isAudio) {
      const response: UploadResponse = {
        mediaId,
        filename: file.originalname,
        url: fileUrl,
        type: 'audio',
      }
      res.json(response)
    } else {
      fs.unlinkSync(file.path)
      res.status(400).json({ error: 'Tipo de archivo no soportado' })
    }
  } catch (err) {
    console.error('Error procesando archivo:', err)
    res.status(500).json({ error: 'Error procesando el archivo' })
  }
})
