import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPLOADS_DIR } from './upload'

export const nanobananaRouter = Router()

const XAI_BASE_URL = 'https://api.x.ai/v1'
const DEFAULT_MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image'

function getApiKey(): string {
  return process.env.XAI_API_KEY || ''
}

function getDefaultModel(): string {
  return process.env.XAI_IMAGE_MODEL || 'grok-imagine-image'
}

interface GenerateRequest {
  prompt: string
  aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9'
  model?: string
}

interface GeneratedImage {
  imageBase64: string
  mimeType: string
}

function getSizeFromAspectRatio(ratio?: string): { width: number; height: number } {
  switch (ratio) {
    case '16:9': return { width: 1366, height: 768 }
    case '9:16': return { width: 768, height: 1366 }
    case '4:3': return { width: 1024, height: 768 }
    case '3:4': return { width: 768, height: 1024 }
    case '21:9': return { width: 1536, height: 658 }
    case '1:1':
    default: return { width: 1024, height: 1024 }
  }
}

function enhancePrompt(prompt: string, aspectRatio?: string): string {
  if (!aspectRatio) return prompt
  const size = getSizeFromAspectRatio(aspectRatio)
  return `${prompt}. The image should have an aspect ratio of ${aspectRatio} (${size.width}x${size.height}).`
}

async function generateImage(prompt: string, model?: string): Promise<GeneratedImage> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('XAI_API_KEY no configurada en .env')
  }

  const url = `${XAI_BASE_URL}/images/generations`
  const body = {
    model: model || getDefaultModel(),
    prompt,
    n: 1,
    response_format: 'b64_json',
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json() as any

  if (!response.ok) {
    const msg = data?.error?.message || JSON.stringify(data)
    throw new Error(`xAI API error (${response.status}): ${msg}`)
  }

  const item = data.data?.[0]
  if (!item) {
    throw new Error('xAI API no retornó imagen')
  }

  const b64 = item.b64_json || item.url
  if (!b64) {
    throw new Error('xAI API no retornó datos de imagen')
  }

  return {
    imageBase64: item.b64_json as string,
    mimeType: 'image/png',
  }
}

// POST /api/nanobanana/generate
// body: { prompt: string, aspectRatio?, model?: string }
nanobananaRouter.post('/nanobanana/generate', async (req: Request, res: Response) => {
  const { prompt, aspectRatio, model } = req.body as GenerateRequest

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  try {
    const enhancedPrompt = enhancePrompt(prompt, aspectRatio)
    const result = await generateImage(enhancedPrompt, model)

    const ext = result.mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const filename = `nb_${uuidv4()}.${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    fs.writeFileSync(filepath, Buffer.from(result.imageBase64, 'base64'))

    res.json({
      imageUrl: `/uploads/${filename}`,
      filename,
      model: model || getDefaultModel(),
    })
  } catch (err: any) {
    console.error('Error generando imagen:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar imagen' })
  }
})

// POST /api/nanobanana/generate-batch
// body: { prompts: string[], aspectRatio?, model?: string }
nanobananaRouter.post('/nanobanana/generate-batch', async (req: Request, res: Response) => {
  const { prompts, aspectRatio, model } = req.body as { prompts: string[]; aspectRatio?: string; model?: string }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    res.status(400).json({ error: 'prompts debe ser un array no vacío' })
    return
  }
  if (prompts.length > 10) {
    res.status(400).json({ error: 'Máximo 10 prompts por batch' })
    return
  }

  try {
    const images: Array<{ imageUrl: string; filename: string; model: string }> = []
    const usedModel = model || getDefaultModel()

    for (const prompt of prompts) {
      const enhancedPrompt = enhancePrompt(prompt, aspectRatio)
      const result = await generateImage(enhancedPrompt, model)

      const ext = result.mimeType === 'image/jpeg' ? 'jpg' : 'png'
      const filename = `nb_${uuidv4()}.${ext}`
      const filepath = path.join(UPLOADS_DIR, filename)

      fs.writeFileSync(filepath, Buffer.from(result.imageBase64, 'base64'))

      images.push({
        imageUrl: `/uploads/${filename}`,
        filename,
        model: usedModel,
      })
    }

    res.json({ images })
  } catch (err: any) {
    console.error('Error generando batch:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar imágenes' })
  }
})

// GET /api/nanobanana/status
nanobananaRouter.get('/nanobanana/status', (_req: Request, res: Response) => {
  res.json({
    provider: 'xAI Grok Imagine',
    models: ['grok-imagine-image', 'grok-imagine-image-pro'],
    available: !!getApiKey(),
    defaultModel: getDefaultModel(),
  })
})
