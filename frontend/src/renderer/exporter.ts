import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
} from 'mediabunny'
import type { VideoConfig, AudioTrackConfig } from '../types/video'
import { VideoRenderer } from './VideoRenderer'
import { computeClipTimings, computeTotalFrames } from '../remotion/utils/timing'

export type ExportQuality = 'high' | 'medium' | 'low'

const QUALITY_FPS: Record<ExportQuality, number> = {
  high: 30,
  medium: 15,
  low: 10,
}

export type ExportProgress = {
  phase: 'preloading' | 'audio' | 'encoding'
  progress: number  // 0..1
  message: string
}

export async function exportVideo(
  config: VideoConfig,
  quality: ExportQuality = 'low',
  onProgress?: (p: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const [w, h] = config.resolution.split('x').map(Number)
  const fps = QUALITY_FPS[quality]
  const projectFps = config.fps
  const projectTotalFrames = config.totalFrames || computeTotalFrames(config.clips)
  const totalDurationSeconds = projectTotalFrames / projectFps
  const totalFrames = Math.round(totalDurationSeconds * fps)

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const renderer = new VideoRenderer(canvas, config)

  onProgress?.({ phase: 'preloading', progress: 0, message: 'Cargando medios...' })
  await renderer.preload((p) => {
    onProgress?.({ phase: 'preloading', progress: p * 0.05, message: 'Cargando medios...' })
  })

  let audioBuffer: AudioBuffer | null = null
  if (config.audioTrack) {
    onProgress?.({ phase: 'audio', progress: 0.05, message: 'Procesando audio...' })
    const { startSeconds: audioStart, endSeconds: audioEnd } = computeAudioWindow(config)
    audioBuffer = await prepareAudioBuffer(config.audioTrack, totalDurationSeconds, projectFps, audioStart, audioEnd)
  }

  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')

  // ─── Setup mediabunny output ──────────────────────────────────────────────
  const bitrate = quality === 'high' ? QUALITY_HIGH : quality === 'medium' ? QUALITY_MEDIUM : QUALITY_LOW

  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat(), target })

  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate })
  output.addVideoTrack(videoSource, { frameRate: fps })

  let audioSource: AudioBufferSource | null = null
  if (audioBuffer) {
    // Check AAC support; fall back to opus if not available
    let audioCodec: 'aac' | 'opus' = 'aac'
    if (typeof AudioEncoder !== 'undefined') {
      try {
        const { supported } = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          bitrate: 192_000,
        })
        if (!supported) audioCodec = 'opus'
      } catch {
        audioCodec = 'opus'
      }
    }
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  // Audio must be added before video frames
  if (audioSource && audioBuffer) {
    await audioSource.add(audioBuffer)
    audioSource.close()
  }

  // ─── Render frames ────────────────────────────────────────────────────────
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      await output.cancel()
      throw new DOMException('Export cancelled', 'AbortError')
    }

    // Convert export frame index to the equivalent project frame (project uses its own fps)
    const projectFrame = Math.round((i / fps) * projectFps)
    await renderer.renderFrame(projectFrame)
    await videoSource.add(i / fps, 1 / fps)

    onProgress?.({
      phase: 'encoding',
      progress: 0.1 + (i / totalFrames) * 0.9,
      message: `Renderizando frame ${i + 1} / ${totalFrames}`,
    })
  }

  if (signal?.aborted) {
    await output.cancel()
    throw new DOMException('Export cancelled', 'AbortError')
  }

  videoSource.close()
  await output.finalize()

  onProgress?.({ phase: 'encoding', progress: 1, message: 'Finalizando...' })

  const buffer = target.buffer
  if (!buffer) throw new Error('No se generó el buffer de video')
  return buffer
}

// ─── Audio window (exclude leading/trailing title clips) ──────────────────

function computeAudioWindow(config: VideoConfig): { startSeconds: number; endSeconds: number } {
  const timings = computeClipTimings(config.clips)
  const totalFrames = config.totalFrames || computeTotalFrames(config.clips)
  const fps = config.fps

  let startFrame = 0
  let endFrame = totalFrames

  // Audio starts at the END of the last consecutive leading title clip
  for (let i = 0; i < config.clips.length; i++) {
    if (config.clips[i].type !== 'title') break
    const t = timings[i]
    startFrame = t.startFrame + t.durationFrames
  }

  // Audio ends at the END of the last non-title clip
  for (let i = config.clips.length - 1; i >= 0; i--) {
    if (config.clips[i].type !== 'title') {
      const t = timings[i]; endFrame = t.startFrame + t.durationFrames; break
    }
  }

  return { startSeconds: startFrame / fps, endSeconds: endFrame / fps }
}

// ─── Audio preparation ─────────────────────────────────────────────────────

async function prepareAudioBuffer(
  track: AudioTrackConfig,
  totalSeconds: number,
  projectFps: number,
  audioStartSeconds: number = 0,
  audioEndSeconds: number = totalSeconds,
): Promise<AudioBuffer> {
  const sampleRate = 44100
  const numChannels = 2

  const offlineCtx = new OfflineAudioContext(
    numChannels,
    Math.ceil(sampleRate * totalSeconds),
    sampleRate,
  )

  const response = await fetch(track.mediaUrl)
  const arrayBuffer = await response.arrayBuffer()
  const decoded = await offlineCtx.decodeAudioData(arrayBuffer)

  const source = offlineCtx.createBufferSource()
  source.buffer = decoded

  const gainNode = offlineCtx.createGain()
  gainNode.gain.setValueAtTime(0, 0)

  if (track.fadeInFrames > 0) {
    const fadeInEnd = audioStartSeconds + track.fadeInFrames / projectFps
    gainNode.gain.setValueAtTime(0, audioStartSeconds)
    gainNode.gain.linearRampToValueAtTime(track.volume, Math.min(fadeInEnd, audioEndSeconds))
  } else {
    gainNode.gain.setValueAtTime(track.volume, audioStartSeconds)
  }

  if (track.fadeOutFrames > 0) {
    const fadeOutStart = Math.max(audioStartSeconds, audioEndSeconds - track.fadeOutFrames / projectFps)
    gainNode.gain.setValueAtTime(track.volume, fadeOutStart)
    gainNode.gain.linearRampToValueAtTime(0, audioEndSeconds)
  }

  source.connect(gainNode)
  gainNode.connect(offlineCtx.destination)
  source.start(audioStartSeconds, track.startFromSeconds)
  if (audioEndSeconds < totalSeconds) {
    source.stop(audioEndSeconds)
  }

  return offlineCtx.startRendering()
}

export function downloadBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'video/mp4' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
