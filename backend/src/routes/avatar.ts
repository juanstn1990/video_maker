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
    + '. Disney-style 2D animated cartoon character, cheerful scene, bright colors, family-friendly.'
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
  'Disney-style 2D animated cartoon character, full body. ' +
  'Classic hand-drawn animation look with fluid, appealing shapes. ' +
  'Large expressive eyes with visible pupils, friendly warm smile, soft rounded facial features. ' +
  'Elegant proportions, graceful posture, iconic Disney silhouette readability. ' +
  'Vibrant but harmonious color palette, subtle cel-shading, clean outlines. ' +
  'Polished professional finish reminiscent of modern Disney 2D animation. '

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
      'Disney-style 2D animated cartoon avatar, full body, head to toe visible, square 1:1 format.',
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
              text: `Describe this Disney-style 2D animated cartoon character for use in AI image generation prompts.
Include: gender, approximate age look, hair (color, style, accessories), eye color and shape, skin tone, clothing (colors, pattern, style), body proportions, distinctive Disney-like features such as large expressive eyes and elegant silhouette.
Single paragraph in English, max 80 words. Start with "A Disney-style 2D animated cartoon character,". No commentary.`,
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
          content: `You are a creative director for a Disney-style 2D animated show — classic hand-drawn animation aesthetic, elegant proportions, large expressive eyes, warm friendly expressions, clean appealing silhouettes, vibrant harmonious colors.

The main character (already illustrated in this style):
${avatarDescription}

STRICT RULES for every scene:
- The main character always appears.
- Other human characters (papa, mama, abuela, etc.) are ONLY included if the story/song text explicitly names or refers to them. When included, list them in "detectedPersons".
- Animals are ONLY included if the story/song text explicitly mentions them.
- If the story implies people but does not name them, replace with inanimate props.
- Never add background people, crowds or unnamed characters.

Output ONLY valid JSON:
{
  "scenes": [
    {
      "number": 1,
      "title": "Scene title in Spanish (max 8 words)",
      "narrative": "2-3 sentences in Spanish describing what happens.",
      "detectedPersons": ["papa", "mama"],
      "scenePrompt": "Rich English prompt for Grok image model (1:1 square composition). Reference the main character as 'the character'. If detectedPersons is non-empty, reference each by role name — they appear as reference images. Include: (1) Character pose and facial expression conveying emotion, (2) Specific action happening at this moment, (3) Detailed environment — describe background layers (foreground props, mid-ground setting, background landscape/sky), (4) Lighting mood (golden hour, soft indoor lamp, bright midday, moonlight, etc.), (5) Color palette of the scene (warm, cool, pastel, vivid), (6) Specific props or objects relevant to the story beat, (7) Camera framing (wide establishing shot, medium shot, close-up). Include animals only if the story mentions them. Cinematic Disney 2D cartoon style. Max 120 words.",
      "pixversePrompt": "PixVerse video prompt in English. [Subject: detailed character description + specific animated action with clear motion arc] [Environment: richly described cartoon scene — background details, lighting, atmosphere, time of day] [Camera: specific movement — slow push-in, gentle pan left/right, subtle tilt, orbit] [Mood: emotional tone of the scene] [Style: 2D animated cartoon, Disney hand-drawn aesthetic, flat cel-shading, bold black outlines, vibrant harmonious colors, 1:1 square format]. Under 110 words."
    }
  ]
}
Note: detectedPersons must be an array of strings (lowercase role names like "papa", "mama", "abuela"). Use [] when no named people appear in the scene.`,
        },
        {
          role: 'user',
          content: `Story/Song (Spanish):\n${storyText}\n\nCreate exactly ${count} scenes as a visual narrative. Respond with the JSON structure.`,
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
      'Disney-style 2D animated cartoon character, full body, head to toe visible, square 1:1 format.',
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
        `The reference image is a side-by-side panel: LEFT is the main character, ` +
        extraLabels.map((l, i) => `${i === 0 && extraLabels.length === 1 ? 'RIGHT' : `POSITION ${i + 2}`} is ${l}`).join(', ') +
        `. All characters must appear in the scene. `
    } else {
      refBuffer = fs.readFileSync(avatarRefPath)
      characterNote =
        `The reference image shows the main character's design — faithfully replicate hair, colors, clothing, face and proportions. ` +
        `Draw the FULL BODY of the character — head to toe — entirely visible with NO cropping. ` +
        `The character is the clear focal point, dynamically posed and filling the center of the 1:1 square frame. ` +
        `Use a full-body or 3/4 wide shot; never a close-up that cuts off limbs or feet. `
    }

    const scenePromptFull =
      `Disney-style 2D animated cartoon. ` +
      `Faithfully replicate the exact character design from the reference image — same hair, colors, clothing, face and proportions. ` +
      characterNote +
      `Scene: ${scenePrompt} ` +
      `Full bodies visible with expressive poses. Bold clean black outlines, vibrant harmonious flat colors with subtle cel-shading. ` +
      `Rich layered background: detailed foreground props, mid-ground setting elements, painted background scenery. ` +
      `Professional Disney 2D animation quality — polished, appealing, story-driven composition.`

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
