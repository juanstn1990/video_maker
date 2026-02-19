import { Router, Request, Response } from 'express'
import { OpenAI } from 'openai'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPLOADS_DIR } from './upload'

export const transcribeRouter = Router()

interface SubtitleWord {
  text: string
  startSeconds: number
  endSeconds: number
}

interface Subtitle {
  id: string
  text: string
  startSeconds: number
  endSeconds: number
  words?: SubtitleWord[]
}

interface RawSegment {
  startSeconds: number
  endSeconds: number
  text: string
  words?: SubtitleWord[]
}

async function alignWithLyrics(
  client: OpenAI,
  rawSegments: RawSegment[],
  lyrics: string,
): Promise<RawSegment[]> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `You are a subtitle correction expert for music videos.
You receive Whisper ASR transcription segments (with timestamps) and the original song lyrics.
Whisper often mishears words in songs—especially slang, proper nouns, non-English words, or fast phrases.
Your job: correct each segment's text to match the actual song lyrics, keeping the timestamps EXACTLY as given.
You may split or merge segments only when clearly necessary for alignment.
Respond with ONLY a valid JSON object in this format:
{"segments": [{"startSeconds": 0.0, "endSeconds": 2.5, "text": "corrected lyric"}, ...]}`,
      },
      {
        role: 'user',
        content: `Whisper transcription segments:\n${JSON.stringify(rawSegments, null, 2)}\n\nOriginal song lyrics:\n${lyrics.trim()}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content) as { segments?: RawSegment[] }
  if (!parsed.segments || !Array.isArray(parsed.segments)) return rawSegments
  return parsed.segments
}

transcribeRouter.post('/transcribe', async (req: Request, res: Response) => {
  const { mediaId, lyrics } = req.body as { mediaId?: string; lyrics?: string }
  if (!mediaId) {
    res.status(400).json({ error: 'Se requiere mediaId' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.startsWith('sk-proj-REPLACE')) {
    res.status(500).json({ error: 'OPENAI_API_KEY no configurada en backend/.env' })
    return
  }

  // Find the audio file in uploads directory
  const files = fs.readdirSync(UPLOADS_DIR)
  const audioFile = files.find((f) => path.basename(f, path.extname(f)) === mediaId)
  if (!audioFile) {
    res.status(404).json({ error: 'Archivo de audio no encontrado' })
    return
  }

  const filePath = path.join(UPLOADS_DIR, audioFile)

  try {
    const client = new OpenAI({ apiKey })

    // Step 1: Transcribe with Whisper (request both segment & word timestamps)
    const response = await (client.audio.transcriptions.create as Function)({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    })

    const whisperSegments = (response as any).segments as Array<{
      text: string
      start: number
      end: number
    }> | undefined

    if (!whisperSegments || whisperSegments.length === 0) {
      // Fallback: whole transcript as one subtitle
      const subtitles: Subtitle[] = [{
        id: uuidv4(),
        text: (response as any).text ?? '',
        startSeconds: 0,
        endSeconds: 9999,
      }]
      res.json({ subtitles, corrected: false })
      return
    }

    // Parse word-level timestamps from top-level response
    const whisperWords = (response as any).words as Array<{
      word: string
      start: number
      end: number
    }> | undefined

    let rawSegments: RawSegment[] = whisperSegments.map((seg) => {
      // Associate words that start within this segment's time range
      const segWords: SubtitleWord[] = whisperWords
        ? whisperWords
            .filter((w) => w.start >= seg.start && w.start < seg.end)
            .map((w) => ({ text: w.word.trim(), startSeconds: w.start, endSeconds: w.end }))
        : []
      return {
        startSeconds: seg.start,
        endSeconds: seg.end,
        text: seg.text.trim(),
        words: segWords.length > 0 ? segWords : undefined,
      }
    })

    // Step 2: If lyrics provided, use GPT-4o to align and correct
    // Note: word timestamps are dropped when lyrics correction is applied
    // because GPT reorders/rewrites the text
    let corrected = false
    if (lyrics && lyrics.trim().length > 10) {
      rawSegments = await alignWithLyrics(client, rawSegments, lyrics)
      corrected = true
    }

    const subtitles: Subtitle[] = rawSegments.map((seg) => ({
      id: uuidv4(),
      text: seg.text.trim(),
      startSeconds: seg.startSeconds,
      endSeconds: seg.endSeconds,
      words: corrected ? undefined : seg.words,
    }))

    res.json({ subtitles, corrected })
  } catch (err: any) {
    console.error('Error transcribiendo audio:', err)
    const message = err?.message ?? 'Error al transcribir'
    res.status(500).json({ error: message })
  }
})
