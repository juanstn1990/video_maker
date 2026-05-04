import { Router, Request, Response } from 'express'
import { OpenAI } from 'openai'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import sharp from 'sharp'
import { UPLOADS_DIR } from './upload'

export const avatarRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.startsWith('sk-proj-REPLACE')) {
    throw new Error('OPENAI_API_KEY no configurada en .env')
  }
  return new OpenAI({ apiKey })
}

function simplifyPrompt(prompt: string): string {
  // Strip scene-specific descriptors that may trigger moderation; keep only style + action core
  return prompt
    .replace(/\b(seductive|sexy|violent|blood|weapon|gun|knife|dead|death|kill|nude|naked|breast|underwear)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/[.,!]+/)[0]  // keep only first sentence as safe fallback
    + '. Personaje de dibujos animados animado en 2D estilo Disney, escena alegre, colores brillantes, apto para toda la familia.'
}

async function callGrokImagine(imageB64: string, mimeType: string, prompt: string, retries = 3): Promise<Buffer> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY no configurada en .env')

  let lastError: Error = new Error('unknown')
  let currentPrompt = prompt

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.x.ai/v1/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-imagine-image',
          prompt: currentPrompt,
          n: 1,
          response_format: 'b64_json',
          aspect_ratio: '1:1',
          resolution: '1k',
          image: { url: `data:${mimeType};base64,${imageB64}` },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        const isModeration = errText.includes('content moderation') || errText.includes('safety')
        if (isModeration && attempt < retries) {
          console.warn(`Content moderation on attempt ${attempt}, retrying with simplified prompt`)
          currentPrompt = simplifyPrompt(prompt)
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        throw new Error(`xAI API error ${response.status}: ${errText}`)
      }

      const json = (await response.json()) as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = json.data?.[0]

      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')

      if (item?.url) {
        const imgRes = await fetch(item.url)
        if (!imgRes.ok) throw new Error('No se pudo descargar la imagen generada por xAI')
        return Buffer.from(await imgRes.arrayBuffer())
      }

      throw new Error('xAI no retornó imagen en la respuesta')
    } catch (err: any) {
      lastError = err
      const isTransient = err.cause?.code === 'EAI_AGAIN' || err.cause?.code === 'ECONNRESET' || err.cause?.code === 'ETIMEDOUT'
      if (isTransient && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt))
        continue
      }
      throw err
    }
  }
  throw lastError
}

const STYLE_PREFIX =
  'Personaje de dibujos animados animado en 2D estilo Disney, cuerpo completo. ' +
  'Aspecto clásico de animación dibujada a mano con formas fluidas y atractivas. ' +
  'Ojos grandes y expresivos con pupilas visibles, sonrisa cálida y amigable, rasgos faciales suaves y redondeados. ' +
  'Proporciones elegantes, postura grácil, silueta icónica de Disney fácilmente reconocible. ' +
  'Paleta de colores vibrante pero armoniosa, sombreado sutil de celda, contornos limpios. ' +
  'Acabado profesional pulido que recuerda a la animación 2D moderna de Disney. '

export interface AvatarScene {
  id: string
  number: number
  title: string
  narrative: string
  scenePrompt: string
  pixversePrompt: string
  detectedPersons: string[]   // e.g. ["papa", "mama"]
}

// POST /api/avatar/analyze
// body: multipart form with field "image"
// Flow: 1) images.edit() photo → Pixar avatar  2) describe generated avatar for PixVerse prompts
// returns: { avatarImageUrl, avatarDescription, photoId }
avatarRouter.post('/avatar/analyze', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere una imagen' })
    return
  }

  try {
    const client = getClient()
    const photoId = uuidv4()

    // Save original photo as reference
    const photoRefFilename = `photo_ref_${photoId}${path.extname(req.file.originalname) || '.png'}`
    fs.writeFileSync(path.join(UPLOADS_DIR, photoRefFilename), req.file.buffer)

    // ── Step 1: generate Disney avatar via Grok using the actual photo ────
    // Crop user photo to a centered square so the avatar is based on a square crop.
    const croppedPhoto = await cropToSquare(req.file.buffer)
    const photoB64 = croppedPhoto.toString('base64')
    const avatarBuffer = await callGrokImagine(
      photoB64,
      'image/png',
      'Avatar de dibujos animados animado en 2D estilo Disney, cuerpo completo, de la cabeza a los pies visible, formato cuadrado 1:1.',
    )
    const squareAvatar = await padToSquare(avatarBuffer)
    const avatarB64 = squareAvatar.toString('base64')

    const avatarFilename = `avatar_ref_${photoId}.png`
    fs.writeFileSync(path.join(UPLOADS_DIR, avatarFilename), squareAvatar)
    const avatarImageUrl = `/uploads/${avatarFilename}`

    // ── Step 2: describe the generated avatar for PixVerse scene prompts ──
    const avatarDescResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${avatarB64}`, detail: 'high' } },
            {
              type: 'text',
              text: `Describe este personaje de dibujos animados animado en 2D estilo Disney para usarlo en prompts de generación de imágenes con IA.
Incluye: género, edad aproximada, cabello (color, estilo, accesorios), color y forma de ojos, tono de piel, ropa (colores, patrón, estilo), proporciones corporales, rasgos distintivos tipo Disney como ojos grandes y expresivos y silueta elegante.
Un solo párrafo en español, máximo 80 palabras. Empieza con "Un personaje de dibujos animados animado en 2D estilo Disney,". Sin comentarios adicionales.`,
            },
          ],
        },
      ],
      max_tokens: 150,
    })
    const avatarDescription = avatarDescResponse.choices[0]?.message?.content?.trim() ?? ''

    res.json({ avatarImageUrl, avatarDescription, photoId })
  } catch (err: any) {
    console.error('Error creando avatar:', err)
    res.status(500).json({ error: err.message ?? 'Error al crear avatar' })
  }
})

// POST /api/avatar/scenes
// body: { storyText, sceneCount, avatarDescription }
// returns: { scenes: AvatarScene[] }
avatarRouter.post('/avatar/scenes', async (req: Request, res: Response) => {
  const { storyText, sceneCount, avatarDescription } = req.body as {
    storyText: string
    sceneCount: number
    avatarDescription: string
  }

  if (!storyText || !sceneCount || !avatarDescription) {
    res.status(400).json({ error: 'storyText, sceneCount y avatarDescription son requeridos' })
    return
  }

  const count = Number(sceneCount)
  if (isNaN(count) || count < 1 || count > 20) {
    res.status(400).json({ error: 'sceneCount debe ser un número entre 1 y 20' })
    return
  }

  try {
    const client = getClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `Eres un director creativo de un programa animado en 2D estilo Disney — estética clásica de animación dibujada a mano, proporciones elegantes, ojos grandes y expresivos, expresiones cálidas y amigables, siluetas limpias y atractivas, colores vibrantes y armoniosos.

El personaje principal (ya ilustrado en este estilo):
${avatarDescription}

REGLAS ESTRICTAS para cada escena:
- El personaje principal siempre aparece.
- Otros personajes humanos (papá, mamá, abuela, etc.) solo se incluyen SI el texto de la historia/canción los nombra o menciona explícitamente. Cuando se incluyan, listarlos en "detectedPersons".
- Los animales solo se incluyen SI el texto de la historia/canción los menciona explícitamente.
- Si la historia implica personas pero no las nombra, reemplazarlas por objetos inanimados.
- Nunca agregar personas de fondo, multitudes o personajes sin nombre.

Genera ÚNICAMENTE JSON válido:
{
  "scenes": [
    {
      "number": 1,
      "title": "Título de la escena en español (máx. 8 palabras)",
      "narrative": "2-3 oraciones en español describiendo lo que ocurre.",
      "detectedPersons": ["papa", "mama"],
      "scenePrompt": "Prompt rico en español para el modelo de imágenes Grok (composición cuadrada 1:1). Refiere al personaje principal como 'el personaje'. Si detectedPersons no está vacío, menciona cada uno por su nombre de rol — aparecen como imágenes de referencia. Incluye: (1) Pose del personaje y expresión facial que transmita emoción, (2) Acción específica que ocurre en este momento, (3) Entorno detallado — describe capas de fondo (objetos en primer plano, escenario en medio plano, paisaje/cielo de fondo), (4) Ambiente de iluminación (hora dorada, lámpara suave interior, mediodía brillante, luz de luna, etc.), (5) Paleta de colores de la escena (cálida, fría, pastel, vívida), (6) Objetos o utilería específicos relevantes para este momento de la historia, (7) Encuadre de cámara (plano general de establecimiento, plano medio, primer plano). Incluye animales solo si la historia los menciona. Estilo de dibujos animados 2D cinemático tipo Disney. Máx. 120 palabras.",
      "pixversePrompt": "Prompt de video en español. [Sujeto: descripción detallada del personaje + acción animada específica con arco de movimiento claro] [Entorno: escena de dibujos animados ricamente descrita — detalles de fondo, iluminación, atmósfera, hora del día] [Cámara: movimiento específico — acercamiento lento, paneo suave izquierda/derecha, inclinación sutil, órbita] [Ambiente: tono emocional de la escena] [Estilo: dibujos animados 2D, estética dibujada a mano tipo Disney, sombreado plano de celda, contornos negros marcados, colores vibrantes y armoniosos, formato cuadrado 1:1]. Máximo 110 palabras."
    }
  ]
}
Nota: detectedPersons debe ser un arreglo de strings (nombres de rol en minúscula como "papa", "mama", "abuela"). Usa [] cuando no aparezcan personas nombradas en la escena.`,
        },
        {
          role: 'user',
          content: `Historia/Canción (español):\n${storyText}\n\nCrea exactamente ${count} escenas como una narrativa visual. Responde con la estructura JSON.`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content) as { scenes?: Omit<AvatarScene, 'id'>[] }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      res.status(500).json({ error: 'Respuesta inesperada de GPT' })
      return
    }

    const scenes: AvatarScene[] = parsed.scenes.slice(0, count).map((s) => ({
      ...s,
      id: uuidv4(),
      detectedPersons: Array.isArray(s.detectedPersons) ? s.detectedPersons : [],
    }))
    res.json({ scenes })
  } catch (err: any) {
    console.error('Error generando escenas:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar escenas' })
  }
})

// POST /api/avatar/person-photo
// body: multipart — fields: image (file), name (string), mainPhotoId (string)
// Generates a Grok Disney avatar for an additional named person.
// returns: { personAvatarUrl, name }
avatarRouter.post('/avatar/person-photo', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere una imagen' })
    return
  }
  const { name, mainPhotoId } = req.body as { name?: string; mainPhotoId?: string }
  if (!name || !mainPhotoId) {
    res.status(400).json({ error: 'name y mainPhotoId son requeridos' })
    return
  }

  try {
    const croppedPhoto = await cropToSquare(req.file.buffer)
    const photoB64 = croppedPhoto.toString('base64')
    const avatarBuffer = await callGrokImagine(
      photoB64,
      'image/png',
      'Personaje de dibujos animados animado en 2D estilo Disney, cuerpo completo, de la cabeza a los pies visible, formato cuadrado 1:1.',
    )
    const squareAvatar = await padToSquare(avatarBuffer)
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const filename = `person_avatar_${safeName}_${mainPhotoId}.png`
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), squareAvatar)
    res.json({ personAvatarUrl: `/uploads/${filename}`, name })
  } catch (err: any) {
    console.error('Error generando avatar de persona:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar avatar' })
  }
})

// Crops a buffer to a centered square of targetSize×targetSize.
// Used for user-uploaded photos so avatars are based on a square crop.
async function cropToSquare(buffer: Buffer, targetSize = 1024): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? targetSize
  const h = meta.height ?? targetSize
  if (w === h && w === targetSize) return buffer
  return sharp(buffer)
    .resize(targetSize, targetSize, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()
}

// Normalizes a buffer to exactly 1024×1024.
// xAI images/edits ignores aspect_ratio and mirrors the INPUT image dimensions,
// so we must guarantee a perfect square before every callGrokImagine call.
async function padToSquare(buffer: Buffer, targetSize = 1024): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? targetSize
  const h = meta.height ?? targetSize
  if (w === h && w === targetSize) return buffer
  const size = Math.max(w, h)
  return sharp(buffer)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 255 } })
    .resize(targetSize, targetSize)
    .png()
    .toBuffer()
}

// Composes multiple avatar PNGs side by side into a single image for multi-character scenes.
async function composeAvatars(mainPath: string, extraPaths: string[]): Promise<Buffer> {
  const SIZE = 512
  const all = [mainPath, ...extraPaths]
  const resized = await Promise.all(
    all.map((p) => sharp(p).resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer()),
  )
  const totalWidth = SIZE * all.length
  const composite = resized.map((buf, i) => ({ input: buf, left: i * SIZE, top: 0 }))
  return sharp({ create: { width: totalWidth, height: SIZE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite(composite)
    .png()
    .toBuffer()
}

// POST /api/avatar/generate-image
// body: { avatarDescription, scenePrompt, sceneId, photoId }
// Uses images.edit() with the saved avatar reference for scene consistency.
// Falls back to images.generate() if the reference file is missing.
// returns: { imageUrl: string }
avatarRouter.post('/avatar/generate-image', async (req: Request, res: Response) => {
  const { avatarDescription, scenePrompt, sceneId, photoId, extraPersonNames } = req.body as {
    avatarDescription: string
    scenePrompt: string
    sceneId?: string
    photoId?: string
    extraPersonNames?: string[]   // e.g. ["papa", "mama"]
  }

  if (!avatarDescription || !scenePrompt) {
    res.status(400).json({ error: 'avatarDescription y scenePrompt son requeridos' })
    return
  }

  try {
    const filename = `avatar_scene_${sceneId ?? uuidv4()}.png`

    const avatarRefPath = photoId
      ? path.join(UPLOADS_DIR, `avatar_ref_${photoId}.png`)
      : null

    if (!avatarRefPath || !fs.existsSync(avatarRefPath)) {
      throw new Error('No se encontró el avatar de referencia. Vuelve a analizar la foto.')
    }

    // Resolve extra person avatar paths
    const extraPaths: string[] = []
    const extraLabels: string[] = []
    if (extraPersonNames && extraPersonNames.length > 0 && photoId) {
      for (const name of extraPersonNames) {
        const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        const p = path.join(UPLOADS_DIR, `person_avatar_${safeName}_${photoId}.png`)
        if (fs.existsSync(p)) {
          extraPaths.push(p)
          extraLabels.push(name)
        }
      }
    }

    // Build reference image: composite if extra persons, otherwise just the main avatar
    let refBuffer: Buffer
    let characterNote = ''
    if (extraPaths.length > 0) {
      refBuffer = await composeAvatars(avatarRefPath, extraPaths)
      characterNote =
        `La imagen de referencia es un panel lado a lado: a la IZQUIERDA está el personaje principal, ` +
        extraLabels.map((l, i) => `${i === 0 && extraLabels.length === 1 ? 'a la DERECHA' : `en la POSICIÓN ${i + 2}`} está ${l}`).join(', ') +
        `. Todos los personajes deben aparecer en la escena. `
    } else {
      refBuffer = fs.readFileSync(avatarRefPath)
      characterNote =
        `La imagen de referencia muestra el diseño del personaje principal — replica fielmente el cabello, colores, ropa, rostro y proporciones. ` +
        `Dibuja el CUERPO COMPLETO del personaje — de la cabeza a los pies — completamente visible SIN recortar. ` +
        `El personaje es el punto focal claro, en una pose dinámica y ocupando el centro del encuadre cuadrado 1:1. ` +
        `Usa un plano de cuerpo completo o un plano 3/4 amplio; nunca un primer plano que recorte extremidades o pies. `
    }

    const scenePromptFull =
      `Dibujos animados animados en 2D estilo Disney. ` +
      `Replica fielmente el diseño exacto del personaje de la imagen de referencia — mismo cabello, colores, ropa, rostro y proporciones. ` +
      characterNote +
      `Escena: ${scenePrompt} ` +
      `Cuerpos completos visibles con poses expresivas. Contornos negros limpios y marcados, colores planos vibrantes y armoniosos con sombreado sutil de celda. ` +
      `Fondo con capas ricas: objetos detallados en primer plano, elementos de escenario en medio plano, paisaje pintado de fondo. ` +
      `Calidad profesional de animación 2D Disney — composición pulida, atractiva y guiada por la narrativa.`

    const paddedRef = await padToSquare(refBuffer)
    const sceneBuffer = await callGrokImagine(
      paddedRef.toString('base64'),
      'image/png',
      scenePromptFull,
    )

    fs.writeFileSync(path.join(UPLOADS_DIR, filename), sceneBuffer)
    res.json({ imageUrl: `/uploads/${filename}` })
  } catch (err: any) {
    console.error('Error generando imagen de escena:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar imagen de escena' })
  }
})

// POST /api/avatar/generate-video
// body: { pixversePrompt, sceneId }
// Generates a 7-second 1:1 square video via xAI grok-imagine-video with polling.
// returns: { videoUrl: string }
avatarRouter.post('/avatar/generate-video', async (req: Request, res: Response) => {
  const { pixversePrompt, sceneId } = req.body as { pixversePrompt?: string; sceneId?: string }
  if (!pixversePrompt) {
    res.status(400).json({ error: 'pixversePrompt es requerido' })
    return
  }

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'XAI_API_KEY no configurada en .env' })
    return
  }

  // Disable socket timeout — video generation can take 2-4 minutes
  req.socket.setTimeout(0)
  res.setTimeout(0)

  try {
    // ── Load scene image as reference ─────────────────────────────────────────
    const sceneImagePath = sceneId ? path.join(UPLOADS_DIR, `avatar_scene_${sceneId}.png`) : null
    const imageB64 = sceneImagePath && fs.existsSync(sceneImagePath)
      ? fs.readFileSync(sceneImagePath).toString('base64')
      : null

    // ── Step 1: kick off generation ───────────────────────────────────────────
    const requestBody: Record<string, unknown> = {
      model: 'grok-imagine-video',
      prompt: pixversePrompt,
      duration: 7,
      aspect_ratio: '1:1',
      resolution: '720p',
    }
    if (imageB64) {
      requestBody.image = { url: `data:image/png;base64,${imageB64}` }
    }

    const initRes = await fetch('https://api.x.ai/v1/videos/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    })

    if (!initRes.ok) {
      const errText = await initRes.text()
      throw new Error(`xAI API error ${initRes.status}: ${errText}`)
    }

    const initJson = (await initRes.json()) as { request_id?: string; id?: string }
    const requestId = initJson.request_id ?? initJson.id
    if (!requestId) throw new Error('xAI no retornó request_id')

    // ── Step 2: poll until done (max 5 min) ──────────────────────────────────
    const MAX_POLLS = 60
    const POLL_MS = 5000
    let videoUrl: string | null = null

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS))

      const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (!pollRes.ok) {
        const errText = await pollRes.text()
        throw new Error(`xAI poll error ${pollRes.status}: ${errText}`)
      }

      const poll = (await pollRes.json()) as {
        status: string
        video?: { url?: string }
        generations?: Array<{ url?: string }>
      }

      if (poll.status === 'done') {
        videoUrl = poll.video?.url ?? poll.generations?.[0]?.url ?? null
        if (videoUrl) break
        throw new Error('xAI retornó done pero sin URL de video')
      }

      if (poll.status === 'failed' || poll.status === 'expired') {
        throw new Error(`Generación de video falló: ${poll.status}`)
      }
    }

    if (!videoUrl) throw new Error('Timeout: el video tardó demasiado en generarse')

    // ── Step 3: download and persist ─────────────────────────────────────────
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error('No se pudo descargar el video generado')
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

    const filename = `avatar_video_${sceneId ?? uuidv4()}.mp4`
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), videoBuffer)

    res.json({ videoUrl: `/uploads/${filename}` })
  } catch (err: any) {
    console.error('Error generando video:', err)
    res.status(500).json({ error: err.message ?? 'Error al generar video' })
  }
})
