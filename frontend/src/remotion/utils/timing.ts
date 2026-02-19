import type { ClipConfig } from '../../types/video'
import type { ClipTiming } from '../../types/timeline'

/**
 * Computes the absolute start frame for each clip, accounting for
 * transition overlap. Clip B starts `transitionFrames` before clip A ends.
 *
 * Example with 15-frame crossfade:
 *   Clip A: frames 0..89   (90 frames)
 *   Clip B: frames 75..164  (starts 15 frames before A ends)
 *   Clip C: frames 150..239
 */
export function computeClipTimings(clips: ClipConfig[]): ClipTiming[] {
  const timings: ClipTiming[] = []
  let cursor = 0

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const overlapFrames = i === 0 ? 0 : clip.transitionIn.durationFrames

    const startFrame = Math.max(0, cursor - overlapFrames)
    timings.push({ startFrame, durationFrames: clip.durationFrames })
    cursor = startFrame + clip.durationFrames
  }

  return timings
}

export function computeTotalFrames(clips: ClipConfig[]): number {
  if (clips.length === 0) return 0
  const timings = computeClipTimings(clips)
  const last = timings[timings.length - 1]
  return last.startFrame + last.durationFrames
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps
}

export function formatTime(frames: number, fps: number): string {
  const totalSeconds = frames / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const remainingFrames = frames % fps
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(remainingFrames).padStart(2, '0')}`
}
