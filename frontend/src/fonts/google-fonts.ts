import type { FontAtlas } from './types'
import { SYSTEM_FONTS } from './system-fonts'

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2'
const FONT_ATLAS_PATH = '/fonts/font-atlas.json'
const FONT_CHUNK_PATH_PREFIX = '/fonts/font-chunk-'

const fullLoaded = new Set<string>()

let cachedAtlas: FontAtlas | null = null
let atlasFetchPromise: Promise<FontAtlas | null> | null = null

function encodeFamily(family: string): string {
  return family.replace(/ /g, '+')
}

export function getCachedFontAtlas(): FontAtlas | null {
  return cachedAtlas
}

export function clearFontAtlasCache(): void {
  cachedAtlas = null
  atlasFetchPromise = null
  fullLoaded.clear()
}

export function loadFontAtlas(): Promise<FontAtlas | null> {
  if (cachedAtlas) return Promise.resolve(cachedAtlas)
  if (atlasFetchPromise) return atlasFetchPromise

  atlasFetchPromise = fetch(FONT_ATLAS_PATH)
    .then(async (res) => {
      if (!res.ok) return null
      const data: FontAtlas = await res.json()
      cachedAtlas = data
      preloadChunkImages(data)
      return data
    })
    .catch(() => null)

  return atlasFetchPromise
}

function preloadChunkImages(atlas: FontAtlas): void {
  const maxChunk = Math.max(...Object.values(atlas.fonts).map((e) => e.ch))
  for (let i = 0; i <= maxChunk; i++) {
    const img = new Image()
    img.src = `${FONT_CHUNK_PATH_PREFIX}${i}.avif`
  }
}

export async function loadFullFont({
  family,
  weights = [400, 700],
}: {
  family: string
  weights?: number[]
}): Promise<void> {
  if (fullLoaded.has(family)) return

  const url = `${GOOGLE_FONTS_CSS}?family=${encodeFamily(family)}:wght@${weights.join(';')}&display=swap`
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
  await new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
  })
  await Promise.all(
    weights.map((w) =>
      document.fonts.load(`${w} 16px "${family.replace(/"/g, '\\"')}"`),
    ),
  )
  fullLoaded.add(family)
}

export async function loadFonts({ families }: { families: string[] }): Promise<void> {
  const google = families.filter((f) => !SYSTEM_FONTS.has(f))
  await Promise.all(google.map((family) => loadFullFont({ family })))
}
