import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'
import type {
  VideoConfig,
  ClipConfig,
  ImageClipConfig,
  TitleClipConfig,
  VideoClipConfig,
  ColorClipConfig,
  TextOverlay,
  AudioTrackConfig,
  SubtitleConfig,
  KenBurnsConfig,
  TransitionConfig,
  VideoResolution,
} from '../types/video'
import { DEFAULT_KEN_BURNS, DEFAULT_TRANSITION } from '../types/video'
import { computeTotalFrames } from '../remotion/utils/timing'

// uuid via crypto API (no dep needed in browser)
function uid(): string {
  return uuidv4()
}

interface EditorStore {
  config: VideoConfig
  savedProjectId: string | null   // DB row ID of the last saved project

  // Project persistence
  setSavedProjectId: (id: string | null) => void
  loadConfig: (config: VideoConfig, dbId: string) => void
  resetProject: () => void

  // Clip mutations
  addImageClip: (mediaId: string, mediaUrl: string) => void
  addImageClips: (items: Array<{ mediaId: string; mediaUrl: string }>) => void
  addVideoClip: (mediaId: string, mediaUrl: string, durationSeconds: number) => void
  addTitleClip: () => void
  moveTitleClip: (clipId: string, position: 'start' | 'end') => void
  addColorClip: (color?: string) => void
  removeClip: (clipId: string) => void
  reorderClips: (fromIndex: number, toIndex: number) => void
  updateClipDuration: (clipId: string, frames: number) => void
  updateKenBurns: (clipId: string, kb: Partial<KenBurnsConfig>) => void
  updateTransition: (clipId: string, t: Partial<TransitionConfig>) => void
  updateImageClip: (clipId: string, updates: Partial<Omit<ImageClipConfig, 'id' | 'type'>>) => void
  updateTitleClip: (clipId: string, updates: Partial<Omit<TitleClipConfig, 'id' | 'type'>>) => void
  updateVideoClip: (clipId: string, updates: Partial<Omit<VideoClipConfig, 'id' | 'type'>>) => void
  updateColorClip: (clipId: string, updates: Partial<Omit<ColorClipConfig, 'id' | 'type'>>) => void

  // Apply-to-all bulk actions for image clips
  applyTransitionToAllImages: (t: Partial<TransitionConfig>) => void
  applyKenBurnsToAllImages: (kb: Partial<KenBurnsConfig>) => void
  applyAdjustmentsToAllImages: (brightness: number, contrast: number, saturation: number) => void
  // Fit image clip durations evenly to match the audio duration
  fitClipDurationsToAudio: (audioDurationSeconds: number) => void

  // Text overlay mutations
  addTextOverlay: (clipId: string) => void
  updateTextOverlay: (clipId: string, overlayId: string, updates: Partial<TextOverlay>) => void
  removeTextOverlay: (clipId: string, overlayId: string) => void

  // Audio
  setAudioTrack: (track: AudioTrackConfig | null) => void

  // Subtitles
  setSubtitleConfig: (config: SubtitleConfig | null) => void

  // Global settings
  updateSettings: (updates: Partial<Pick<VideoConfig, 'resolution' | 'fps' | 'name'>>) => void
}

const DEFAULT_CLIP_DURATION_FRAMES = 90 // 3 seconds at 30fps

const DEFAULT_CONFIG = (): VideoConfig => ({
  id: uid(),
  name: 'Mi Video',
  resolution: '1080x1920',
  fps: 15,
  clips: [],
  audioTrack: null,
  subtitleConfig: null,
  totalFrames: 0,
})

export const useEditorStore = create<EditorStore>()(
  immer((set) => ({
    config: DEFAULT_CONFIG(),
    savedProjectId: null,

    setSavedProjectId: (id) =>
      set((state) => { state.savedProjectId = id }),

    loadConfig: (config, dbId) =>
      set((state) => {
        state.config = config
        state.savedProjectId = dbId
      }),

    resetProject: () =>
      set((state) => {
        state.config = DEFAULT_CONFIG()
        state.savedProjectId = null
      }),

    addImageClip: (mediaId, mediaUrl) =>
      set((state) => {
        const clip: ImageClipConfig = {
          id: uid(),
          type: 'image',
          mediaId,
          mediaUrl,
          durationFrames: DEFAULT_CLIP_DURATION_FRAMES,
          kenBurns: { ...DEFAULT_KEN_BURNS },
          transitionIn: { ...DEFAULT_TRANSITION },
          textOverlays: [],
          brightness: 0,
          contrast: 0,
          saturation: 0,
          rotation: 0,
          cropZoom: 1,
          cropX: 0,
          cropY: 0,
          fitMode: 'cover',
        }
        state.config.clips.push(clip)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    addVideoClip: (mediaId, mediaUrl, durationSeconds) =>
      set((state) => {
        const fps = state.config.fps
        const clip: VideoClipConfig = {
          id: uid(),
          type: 'video',
          mediaId,
          mediaUrl,
          durationSeconds,
          durationFrames: Math.max(15, Math.round(durationSeconds * fps)),
          transitionIn: { ...DEFAULT_TRANSITION },
          textOverlays: [],
          volume: 1,
          muted: true,
          startFromSeconds: 0,
          fitMode: 'cover',
        }
        state.config.clips.push(clip)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    addImageClips: (items) =>
      set((state) => {
        for (const { mediaId, mediaUrl } of items) {
          state.config.clips.push({
            id: uid(),
            type: 'image',
            mediaId,
            mediaUrl,
            durationFrames: DEFAULT_CLIP_DURATION_FRAMES,
            kenBurns: { ...DEFAULT_KEN_BURNS },
            transitionIn: { ...DEFAULT_TRANSITION },
            textOverlays: [],
            brightness: 0,
            contrast: 0,
            saturation: 0,
            rotation: 0,
            cropZoom: 1,
            cropX: 0,
            cropY: 0,
            fitMode: 'cover',
          })
        }
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    applyTransitionToAllImages: (t) =>
      set((state) => {
        state.config.clips.forEach((clip) => {
          if (clip.type === 'image') Object.assign(clip.transitionIn, t)
        })
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    applyKenBurnsToAllImages: (kb) =>
      set((state) => {
        state.config.clips.forEach((clip) => {
          if (clip.type === 'image') Object.assign(clip.kenBurns, kb)
        })
      }),

    applyAdjustmentsToAllImages: (brightness, contrast, saturation) =>
      set((state) => {
        state.config.clips.forEach((clip) => {
          if (clip.type === 'image') {
            clip.brightness = brightness
            clip.contrast = contrast
            clip.saturation = saturation
          }
        })
      }),

    fitClipDurationsToAudio: (audioDurationSeconds) =>
      set((state) => {
        const fps = state.config.fps
        const imageClips = state.config.clips.filter((c) => c.type === 'image')
        if (imageClips.length === 0) return

        // Total transition overlap consumed across all image clips (clips 2..N overlap with previous)
        let transitionOverlapFrames = 0
        let firstImageSeen = false
        state.config.clips.forEach((clip) => {
          if (clip.type !== 'image') return
          if (firstImageSeen) transitionOverlapFrames += clip.transitionIn.durationFrames
          else firstImageSeen = true
        })

        // Solve: N * D - transitionOverlap = audioFrames  →  D = (audioFrames + overlap) / N
        const audioFrames = Math.round(audioDurationSeconds * fps)
        const N = imageClips.length
        const framesPerClip = Math.max(
          Math.round(fps * 0.5), // minimum 0.5s per clip
          Math.round((audioFrames + transitionOverlapFrames) / N),
        )

        state.config.clips.forEach((clip) => {
          if (clip.type === 'image') clip.durationFrames = framesPerClip
        })
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    addColorClip: (color = '#1e1e2e') =>
      set((state) => {
        const clip: ColorClipConfig = {
          id: uid(),
          type: 'color',
          backgroundColor: color,
          durationFrames: 90,
          transitionIn: { type: 'fade', durationFrames: 15 },
          textOverlays: [],
        }
        state.config.clips.push(clip)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    addTitleClip: () =>
      set((state) => {
        const clip: TitleClipConfig = {
          id: uid(),
          type: 'title',
          text: 'Título',
          fontSize: 80,
          fontFamily: 'sans-serif',
          color: '#ffffff',
          backgroundColor: '#000000',
          durationFrames: state.config.fps * 4,
          transitionIn: { type: 'fade', durationFrames: 15 },
          textOverlays: [],
          animationIn: 'fadeIn',
          animationOut: 'fadeIn',
        }
        state.config.clips.unshift(clip)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    moveTitleClip: (clipId, position) =>
      set((state) => {
        const idx = state.config.clips.findIndex((c) => c.id === clipId)
        if (idx === -1) return
        const [clip] = state.config.clips.splice(idx, 1)
        if (position === 'start') state.config.clips.unshift(clip)
        else state.config.clips.push(clip)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    removeClip: (clipId) =>
      set((state) => {
        state.config.clips = state.config.clips.filter((c) => c.id !== clipId)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    reorderClips: (fromIndex, toIndex) =>
      set((state) => {
        const [moved] = state.config.clips.splice(fromIndex, 1)
        state.config.clips.splice(toIndex, 0, moved)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    updateClipDuration: (clipId, frames) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip) clip.durationFrames = Math.max(15, frames)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    updateKenBurns: (clipId, kb) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip?.type === 'image') Object.assign(clip.kenBurns, kb)
      }),

    updateTransition: (clipId, t) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip) Object.assign(clip.transitionIn, t)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    updateImageClip: (clipId, updates) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip?.type === 'image') Object.assign(clip, updates)
      }),

    updateTitleClip: (clipId, updates) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip?.type === 'title') Object.assign(clip, updates)
      }),

    updateVideoClip: (clipId, updates) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip?.type === 'video') Object.assign(clip, updates)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    updateColorClip: (clipId, updates) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip?.type === 'color') Object.assign(clip, updates)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),

    addTextOverlay: (clipId) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (!clip) return
        clip.textOverlays.push({
          id: uid(),
          text: 'Texto',
          startFrame: 0,
          durationFrames: clip.durationFrames,
          x: 0.5,
          y: 0.5,
          fontSize: 48,
          fontFamily: 'sans-serif',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 2,
          backgroundColor: 'transparent',
          animationIn: 'fadeIn',
          animationOut: 'none',
          animationDuration: 15,
          align: 'center',
          bold: false,
          italic: false,
        })
      }),

    updateTextOverlay: (clipId, overlayId, updates) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (!clip) return
        const overlay = clip.textOverlays.find((o) => o.id === overlayId)
        if (overlay) Object.assign(overlay, updates)
      }),

    removeTextOverlay: (clipId, overlayId) =>
      set((state) => {
        const clip = state.config.clips.find((c) => c.id === clipId)
        if (clip) clip.textOverlays = clip.textOverlays.filter((o) => o.id !== overlayId)
      }),

    setAudioTrack: (track) =>
      set((state) => {
        state.config.audioTrack = track
      }),

    setSubtitleConfig: (config) =>
      set((state) => {
        state.config.subtitleConfig = config
      }),

    updateSettings: (updates) =>
      set((state) => {
        Object.assign(state.config, updates)
        state.config.totalFrames = computeTotalFrames(state.config.clips)
      }),
  })),
)
