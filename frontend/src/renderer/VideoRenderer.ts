import type {
  VideoConfig,
  ClipConfig,
  ImageClipConfig,
  TitleClipConfig,
  VideoClipConfig,
  TextOverlay,
  SubtitleConfig,
  Subtitle,
  ImageFitMode,
} from '../types/video'
import { computeClipTimings } from '../remotion/utils/timing'
import type { ClipTiming } from '../types/timeline'

// ─── Helpers ────────────────────────────────────────────────────────────────

function lerp(frame: number, inputRange: [number, number], outputRange: [number, number]): number {
  const [fromF, toF] = inputRange
  const [fromV, toV] = outputRange
  const t = Math.max(0, Math.min(1, (frame - fromF) / Math.max(1, toF - fromF)))
  return fromV + (toV - fromV) * t
}

const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${opacity / 100})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Renderer ───────────────────────────────────────────────────────────────

export class VideoRenderer {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: VideoConfig
  private timings: ClipTiming[]
  private images = new Map<string, HTMLImageElement>()
  private videos = new Map<string, HTMLVideoElement>()

  constructor(canvas: HTMLCanvasElement, config: VideoConfig) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    this.ctx = ctx
    this.config = config
    this.timings = computeClipTimings(config.clips)
  }

  async preload(onProgress?: (p: number) => void): Promise<void> {
    const items: Array<{ url: string; type: 'image' | 'video' }> = []

    for (const clip of this.config.clips) {
      if (clip.type === 'image') {
        items.push({ url: clip.mediaUrl, type: 'image' })
      } else if (clip.type === 'video') {
        items.push({ url: clip.mediaUrl, type: 'video' })
      } else if (clip.type === 'title' && clip.backgroundMediaUrl) {
        items.push({ url: clip.backgroundMediaUrl, type: 'image' })
      }
    }

    let done = 0
    await Promise.all(
      items.map(async ({ url, type }) => {
        if (type === 'image') await this.loadImage(url)
        else await this.loadVideo(url)
        onProgress?.(++done / Math.max(1, items.length))
      }),
    )

    // Trigger font loading by measuring with each font
    const fonts = new Set<string>()
    for (const clip of this.config.clips) {
      if (clip.type === 'title') fonts.add(clip.fontFamily)
      for (const ov of clip.textOverlays) fonts.add(ov.fontFamily)
    }
    if (this.config.subtitleConfig?.enabled) {
      fonts.add(this.config.subtitleConfig.fontFamily)
    }
    for (const f of fonts) {
      this.ctx.font = `16px ${f}`
      this.ctx.measureText('test')
    }
    await document.fonts.ready
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    if (this.images.has(url)) return Promise.resolve(this.images.get(url)!)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => { this.images.set(url, img); resolve(img) }
      img.onerror = reject
      img.src = url
    })
  }

  private loadVideo(url: string): Promise<HTMLVideoElement> {
    if (this.videos.has(url)) return Promise.resolve(this.videos.get(url)!)
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'auto'
      video.onloadeddata = () => { this.videos.set(url, video); resolve(video) }
      video.onerror = reject
      video.src = url
    })
  }

  async renderFrame(absoluteFrame: number): Promise<void> {
    const { ctx } = this
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    for (let i = 0; i < this.config.clips.length; i++) {
      const clip = this.config.clips[i]
      const { startFrame, durationFrames } = this.timings[i]
      const localFrame = absoluteFrame - startFrame
      if (localFrame < 0 || localFrame >= durationFrames) continue

      ctx.save()
      this.applyTransition(clip, localFrame, i, w, h)
      await this.drawClip(clip, localFrame, w, h)
      for (const overlay of clip.textOverlays) {
        this.drawTextOverlay(overlay, localFrame, w, h)
      }
      ctx.restore()
    }

    if (this.config.subtitleConfig?.enabled) {
      this.drawSubtitles(this.config.subtitleConfig, absoluteFrame / this.config.fps, w, h)
    }
  }

  // ─── Transition ─────────────────────────────────────────────────────────

  private applyTransition(
    clip: ClipConfig, localFrame: number, index: number, w: number, h: number,
  ): void {
    const { ctx } = this
    if (index === 0) return
    const { type, durationFrames } = clip.transitionIn
    if (type === 'none' || durationFrames === 0 || localFrame >= durationFrames) return

    const p = localFrame / durationFrames

    switch (type) {
      case 'crossfade':
      case 'fade':
        ctx.globalAlpha = p
        break
      case 'slideLeft':
        ctx.translate((1 - p) * w, 0)
        break
      case 'slideRight':
        ctx.translate(-(1 - p) * w, 0)
        break
      case 'slideUp':
        ctx.translate(0, (1 - p) * h)
        break
      case 'slideDown':
        ctx.translate(0, -(1 - p) * h)
        break
      case 'zoomIn':
        ctx.globalAlpha = p
        ctx.translate(w / 2, h / 2)
        ctx.scale(1.3 - 0.3 * p, 1.3 - 0.3 * p)
        ctx.translate(-w / 2, -h / 2)
        break
      case 'zoomOut':
        ctx.globalAlpha = p
        ctx.translate(w / 2, h / 2)
        ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p)
        ctx.translate(-w / 2, -h / 2)
        break
      case 'wipeLeft':
        ctx.beginPath()
        ctx.rect(0, 0, p * w, h)
        ctx.clip()
        break
      case 'wipeRight':
        ctx.beginPath()
        ctx.rect((1 - p) * w, 0, p * w, h)
        ctx.clip()
        break
    }
  }

  // ─── Clip drawing ────────────────────────────────────────────────────────

  private async drawClip(clip: ClipConfig, localFrame: number, w: number, h: number): Promise<void> {
    if (clip.type === 'image') await this.drawImageClip(clip, localFrame, w, h)
    else if (clip.type === 'video') await this.drawVideoClip(clip, localFrame, w, h)
    else await this.drawTitleClip(clip, localFrame, w, h)
  }

  private async drawImageClip(clip: ImageClipConfig, localFrame: number, w: number, h: number): Promise<void> {
    const img = this.images.get(clip.mediaUrl)
    if (!img) return

    const { kenBurns } = clip
    const raw = Math.max(0, Math.min(1, localFrame / Math.max(1, clip.durationFrames - 1)))
    const eased = easings[kenBurns.easing](raw)

    const kbScale = kenBurns.startScale + (kenBurns.endScale - kenBurns.startScale) * eased
    const panX = kenBurns.startX + (kenBurns.endX - kenBurns.startX) * eased
    const panY = kenBurns.startY + (kenBurns.endY - kenBurns.startY) * eased
    const kbTx = (panX * 100) / kbScale
    const kbTy = (panY * 100) / kbScale

    const cropZoom = clip.cropZoom ?? 1
    const cropX = clip.cropX ?? 0
    const cropY = clip.cropY ?? 0
    const rotation = clip.rotation ?? 0
    const effectiveScale = kbScale * cropZoom
    const effectiveTx = kbTx + (cropX * 100) / effectiveScale
    const effectiveTy = kbTy + (cropY * 100) / effectiveScale

    const { ctx } = this
    ctx.save()

    const filterParts: string[] = []
    if (clip.brightness !== 0) filterParts.push(`brightness(${1 + clip.brightness})`)
    if (clip.contrast !== 0) filterParts.push(`contrast(${1 + clip.contrast})`)
    if (clip.saturation !== 0) filterParts.push(`saturate(${1 + clip.saturation})`)
    if (filterParts.length) ctx.filter = filterParts.join(' ')

    // Replicate CSS: transform-origin center; rotate → scale → translate
    ctx.translate(w / 2, h / 2)
    if (rotation) ctx.rotate(rotation * Math.PI / 180)
    ctx.scale(effectiveScale, effectiveScale)
    ctx.translate((effectiveTx / 100) * w, (effectiveTy / 100) * h)

    this.drawImageFit(img, -w / 2, -h / 2, w, h, clip.fitMode ?? 'cover')

    ctx.restore()
    ctx.filter = 'none'
  }

  private async drawVideoClip(clip: VideoClipConfig, localFrame: number, w: number, h: number): Promise<void> {
    const video = this.videos.get(clip.mediaUrl)
    if (!video) return

    const targetTime = clip.startFromSeconds + localFrame / this.config.fps
    if (Math.abs(video.currentTime - targetTime) > 1 / this.config.fps) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = targetTime
      })
    }

    this.ctx.save()
    this.drawImageFit(video, 0, 0, w, h, clip.fitMode ?? 'cover')
    this.ctx.restore()
  }

  private async drawTitleClip(clip: TitleClipConfig, localFrame: number, w: number, h: number): Promise<void> {
    const { ctx } = this

    if (clip.backgroundMediaUrl) {
      const bgImg = this.images.get(clip.backgroundMediaUrl)
      if (bgImg) this.drawImageFit(bgImg, 0, 0, w, h, 'cover')
    } else {
      ctx.fillStyle = clip.backgroundColor
      ctx.fillRect(0, 0, w, h)
    }

    const dur = clip.durationFrames
    const animDur = Math.max(1, Math.min(20, Math.floor(dur * 0.3)))

    let opacity = 1, translateY = 0, translateX = 0, scale = 1

    switch (clip.animationIn) {
      case 'fadeIn':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        break
      case 'slideUp':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        translateY = lerp(localFrame, [0, animDur], [60, 0])
        break
      case 'slideDown':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        translateY = lerp(localFrame, [0, animDur], [-60, 0])
        break
      case 'slideLeft':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        translateX = lerp(localFrame, [0, animDur], [80, 0])
        break
      case 'slideRight':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        translateX = lerp(localFrame, [0, animDur], [-80, 0])
        break
      case 'zoom':
        opacity = lerp(localFrame, [0, animDur], [0, 1])
        scale = lerp(localFrame, [0, animDur], [0.7, 1])
        break
      case 'bounce': {
        opacity = lerp(localFrame, [0, Math.max(1, animDur * 0.3)], [0, 1])
        const t1 = animDur * 0.55, t2 = animDur * 0.8
        if (localFrame <= t1) translateY = lerp(localFrame, [0, t1], [80, -14])
        else if (localFrame <= t2) translateY = lerp(localFrame, [t1, t2], [-14, 6])
        else translateY = lerp(localFrame, [t2, animDur], [6, 0])
        break
      }
      case 'pop': {
        opacity = lerp(localFrame, [0, Math.max(1, animDur * 0.25)], [0, 1])
        const peak = animDur * 0.6
        scale = localFrame <= peak
          ? lerp(localFrame, [0, peak], [0.2, 1.25])
          : lerp(localFrame, [peak, animDur], [1.25, 1])
        break
      }
      case 'glitch': {
        const prog = Math.min(1, localFrame / Math.max(1, animDur))
        const intensity = (1 - prog) * 12
        translateX = Math.sin(localFrame * 2.3) * intensity
        translateY = Math.sin(localFrame * 1.7 + 1) * intensity * 0.4
        opacity = prog < 0.2 ? lerp(localFrame, [0, animDur * 0.2], [0.4, 1]) : 1
        break
      }
    }

    const exitStart = dur - animDur
    if (localFrame > exitStart && exitStart < dur && clip.animationOut !== 'none') {
      opacity = Math.min(opacity, lerp(localFrame, [exitStart, dur], [1, 0]))
    }

    const visibleText = clip.animationIn === 'typewriter'
      ? clip.text.slice(0, Math.floor(lerp(localFrame, [0, animDur], [0, clip.text.length])))
      : clip.text

    ctx.save()
    ctx.globalAlpha = Math.max(0, opacity)
    ctx.translate(w / 2 + translateX, h / 2 + translateY)
    ctx.scale(scale, scale)

    ctx.font = `bold ${clip.fontSize}px ${clip.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 20
    ctx.fillStyle = clip.color
    ctx.fillText(visibleText, 0, 0)

    if (clip.subtext) {
      const subSize = clip.fontSize * 0.5
      ctx.font = `${subSize}px ${clip.fontFamily}`
      ctx.globalAlpha = Math.max(0, opacity * 0.85)
      ctx.fillText(clip.subtext, 0, clip.fontSize * 0.5 + 16)
    }

    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ─── Image fit ───────────────────────────────────────────────────────────

  private drawImageFit(
    source: HTMLImageElement | HTMLVideoElement,
    x: number, y: number, w: number, h: number,
    fitMode: ImageFitMode,
  ): void {
    const { ctx } = this
    const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth
    const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight

    if (!srcW || !srcH) { ctx.drawImage(source, x, y, w, h); return }

    const srcAR = srcW / srcH
    const dstAR = w / h

    if (fitMode === 'contain') {
      if (srcAR > dstAR) {
        const dh = w / srcAR
        ctx.drawImage(source, x, y + (h - dh) / 2, w, dh)
      } else {
        const dw = h * srcAR
        ctx.drawImage(source, x + (w - dw) / 2, y, dw, h)
      }
    } else if (fitMode === 'fill') {
      ctx.drawImage(source, x, y, w, h)
    } else {
      // cover
      if (srcAR > dstAR) {
        const cropW = srcH * dstAR
        const sx = (srcW - cropW) / 2
        ctx.drawImage(source, sx, 0, cropW, srcH, x, y, w, h)
      } else {
        const cropH = srcW / dstAR
        const sy = (srcH - cropH) / 2
        ctx.drawImage(source, 0, sy, srcW, cropH, x, y, w, h)
      }
    }
  }

  // ─── Text overlays ───────────────────────────────────────────────────────

  private drawTextOverlay(overlay: TextOverlay, localFrame: number, w: number, h: number): void {
    const { ctx } = this
    if (localFrame < overlay.startFrame || localFrame > overlay.startFrame + overlay.durationFrames) return

    const rel = localFrame - overlay.startFrame
    const animDur = Math.max(1, overlay.animationDuration)
    const exitStart = overlay.durationFrames - animDur

    let entryOpacity = 1, entryY = 0, entryX = 0, entryScale = 1

    switch (overlay.animationIn) {
      case 'fadeIn':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        break
      case 'slideUp':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        entryY = lerp(rel, [0, animDur], [40, 0])
        break
      case 'slideDown':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        entryY = lerp(rel, [0, animDur], [-40, 0])
        break
      case 'slideLeft':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        entryX = lerp(rel, [0, animDur], [60, 0])
        break
      case 'slideRight':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        entryX = lerp(rel, [0, animDur], [-60, 0])
        break
      case 'zoom':
        entryOpacity = lerp(rel, [0, animDur], [0, 1])
        entryScale = lerp(rel, [0, animDur], [0.5, 1])
        break
      case 'bounce': {
        entryOpacity = lerp(rel, [0, Math.max(1, animDur * 0.3)], [0, 1])
        const t1 = animDur * 0.55, t2 = animDur * 0.8
        if (rel <= t1) entryY = lerp(rel, [0, t1], [80, -14])
        else if (rel <= t2) entryY = lerp(rel, [t1, t2], [-14, 6])
        else entryY = lerp(rel, [t2, animDur], [6, 0])
        break
      }
      case 'pop': {
        entryOpacity = lerp(rel, [0, Math.max(1, animDur * 0.25)], [0, 1])
        const peak = animDur * 0.6
        entryScale = rel <= peak
          ? lerp(rel, [0, peak], [0.2, 1.25])
          : lerp(rel, [peak, animDur], [1.25, 1])
        break
      }
      case 'glitch': {
        const prog = Math.min(1, rel / Math.max(1, animDur))
        const intensity = (1 - prog) * 10
        entryX = Math.sin(rel * 2.3) * intensity
        entryY = Math.sin(rel * 1.7 + 1) * intensity * 0.4
        entryOpacity = prog < 0.2 ? lerp(rel, [0, animDur * 0.2], [0.4, 1]) : 1
        break
      }
    }

    let exitOpacity = 1
    if (rel > exitStart && exitStart < overlay.durationFrames && overlay.animationOut !== 'none') {
      exitOpacity = lerp(rel, [exitStart, overlay.durationFrames], [1, 0])
    }

    const opacity = Math.min(entryOpacity, exitOpacity)
    if (opacity <= 0) return

    const visibleText = overlay.animationIn === 'typewriter'
      ? overlay.text.slice(0, Math.floor(lerp(rel, [0, animDur], [0, overlay.text.length])))
      : overlay.text

    ctx.save()
    ctx.globalAlpha = opacity

    const fontParts = [
      overlay.italic ? 'italic' : '',
      overlay.bold ? 'bold' : '',
      `${overlay.fontSize}px`,
      overlay.fontFamily,
    ].filter(Boolean)
    ctx.font = fontParts.join(' ')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.translate(overlay.x * w + entryX, overlay.y * h + entryY)
    ctx.scale(entryScale, entryScale)

    if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
      const metrics = ctx.measureText(visibleText)
      const pad = 12
      const bh = overlay.fontSize * 1.4
      ctx.fillStyle = overlay.backgroundColor
      roundRect(ctx, -metrics.width / 2 - pad, -bh / 2 - pad / 2, metrics.width + pad * 2, bh + pad / 2, 4)
      ctx.fill()
    }

    if (overlay.strokeWidth > 0) {
      ctx.strokeStyle = overlay.strokeColor
      ctx.lineWidth = overlay.strokeWidth * 2
      ctx.lineJoin = 'round'
      ctx.strokeText(visibleText, 0, 0)
    }
    ctx.fillStyle = overlay.color
    ctx.fillText(visibleText, 0, 0)

    ctx.restore()
  }

  // ─── Subtitles ───────────────────────────────────────────────────────────

  private drawSubtitles(config: SubtitleConfig, currentSeconds: number, w: number, h: number): void {
    const { ctx } = this
    const fps = this.config.fps

    const active = config.subtitles.find(
      (s) => currentSeconds >= s.startSeconds && currentSeconds <= s.endSeconds,
    )
    if (!active) return

    const activeFrames = Math.round((currentSeconds - active.startSeconds) * fps)
    const subtitleDurFrames = Math.round((active.endSeconds - active.startSeconds) * fps)
    const animDur = Math.max(1, Math.min(12, Math.floor(subtitleDurFrames * 0.25)))

    let entryOpacity = 1, entryY = 0, entryScale = 1

    switch (config.animationIn ?? 'fadeIn') {
      case 'fadeIn':
        entryOpacity = lerp(activeFrames, [0, animDur], [0, 1])
        break
      case 'slideUp':
        entryOpacity = lerp(activeFrames, [0, animDur], [0, 1])
        entryY = lerp(activeFrames, [0, animDur], [30, 0])
        break
      case 'bounce': {
        entryOpacity = lerp(activeFrames, [0, Math.max(1, animDur * 0.4)], [0, 1])
        const t1 = animDur * 0.55, t2 = animDur * 0.8
        if (activeFrames <= t1) entryY = lerp(activeFrames, [0, t1], [40, -8])
        else if (activeFrames <= t2) entryY = lerp(activeFrames, [t1, t2], [-8, 3])
        else entryY = lerp(activeFrames, [t2, animDur], [3, 0])
        break
      }
      case 'pop': {
        entryOpacity = lerp(activeFrames, [0, Math.max(1, animDur * 0.3)], [0, 1])
        const peak = animDur * 0.6
        entryScale = activeFrames <= peak
          ? lerp(activeFrames, [0, peak], [0.3, 1.2])
          : lerp(activeFrames, [peak, animDur], [1.2, 1])
        break
      }
    }

    const text = active.text
    const { fontSize, fontFamily } = config

    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxTextWidth = w * 0.9
    const lines = this.wrapText(text, maxTextWidth)
    const lineHeight = fontSize * 1.4
    const totalHeight = lines.length * lineHeight

    let baseY: number
    if (config.position === 'top') baseY = 80 + totalHeight / 2
    else if (config.position === 'center') baseY = h / 2
    else baseY = h - 80 - totalHeight / 2

    ctx.save()
    ctx.globalAlpha = Math.max(0, entryOpacity)
    ctx.translate(w / 2, baseY + entryY)
    ctx.scale(entryScale, entryScale)

    if (config.backgroundBox) {
      const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width))
      const pad = 16, padV = 8
      const bgColor = config.backgroundBoxColor ?? '#000000'
      const bgOpacity = config.backgroundBoxOpacity !== undefined ? config.backgroundBoxOpacity : 60
      ctx.fillStyle = hexToRgba(bgColor, bgOpacity)
      roundRect(ctx, -maxLineWidth / 2 - pad, -totalHeight / 2 - padV, maxLineWidth + pad * 2, totalHeight + padV * 2, 6)
      ctx.fill()
    }

    if (config.karaokeStyle) {
      this.drawKaraokeText(active, currentSeconds, text, config, 0, 0)
    } else {
      lines.forEach((line, i) => {
        const lineY = (i - (lines.length - 1) / 2) * lineHeight
        if (config.strokeWidth > 0) {
          ctx.strokeStyle = config.strokeColor
          ctx.lineWidth = config.strokeWidth * 2
          ctx.lineJoin = 'round'
          ctx.strokeText(line, 0, lineY)
        }
        ctx.fillStyle = config.color
        ctx.fillText(line, 0, lineY)
      })
    }

    ctx.restore()
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && this.ctx.measureText(candidate).width > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines
  }

  private drawKaraokeText(
    subtitle: Subtitle,
    currentSeconds: number,
    text: string,
    config: SubtitleConfig,
    x: number,
    y: number,
  ): void {
    const { ctx } = this
    const highlightColor = config.karaokeHighlightColor ?? '#FFD700'
    const baseColor = config.color
    const words = subtitle.words

    if (!words || words.length === 0) {
      const duration = subtitle.endSeconds - subtitle.startSeconds
      const elapsed = currentSeconds - subtitle.startSeconds
      const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0
      const metrics = ctx.measureText(text)
      const textW = metrics.width
      const gradient = ctx.createLinearGradient(x - textW / 2, 0, x + textW / 2, 0)
      gradient.addColorStop(Math.max(0, Math.min(1, progress)), highlightColor)
      gradient.addColorStop(Math.max(0, Math.min(1, progress)), baseColor)
      if (progress < 1) gradient.addColorStop(1, baseColor)
      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor
        ctx.lineWidth = config.strokeWidth * 2
        ctx.strokeText(text, x, y)
      }
      ctx.fillStyle = gradient
      ctx.fillText(text, x, y)
      return
    }

    // Word-by-word
    let curX = x - ctx.measureText(text).width / 2
    const originalAlign = ctx.textAlign
    ctx.textAlign = 'left'
    for (let i = 0; i < words.length; i++) {
      const wordStr = i === 0 ? words[i].text : ' ' + words[i].text
      const wordW = ctx.measureText(wordStr).width
      const color = currentSeconds >= words[i].startSeconds ? highlightColor : baseColor
      if (config.strokeWidth > 0) {
        ctx.strokeStyle = config.strokeColor
        ctx.lineWidth = config.strokeWidth * 2
        ctx.strokeText(wordStr, curX, y)
      }
      ctx.fillStyle = color
      ctx.fillText(wordStr, curX, y)
      curX += wordW
    }
    ctx.textAlign = originalAlign
  }
}
