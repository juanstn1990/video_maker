// ─── Ken Burns ─────────────────────────────────────────────────────────────
export interface KenBurnsConfig {
  startX: number     // -0.5 to 0.5, pan offset normalized
  startY: number
  startScale: number // 1.0 = no zoom, 1.3 = 30% zoom in
  endX: number
  endY: number
  endScale: number
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut'
}

// ─── Transitions ────────────────────────────────────────────────────────────
export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'fade'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'wipeLeft'
  | 'wipeRight'

export interface TransitionConfig {
  type: TransitionType
  durationFrames: number
}

// ─── Text overlays ──────────────────────────────────────────────────────────
export type TextAnimation =
  | 'none'
  | 'fadeIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'typewriter'
  | 'zoom'
  | 'bounce'
  | 'pop'
  | 'glitch'

export interface TextOverlay {
  id: string
  text: string
  startFrame: number    // relative to clip start
  durationFrames: number
  x: number             // 0..1 normalized (0=left, 1=right)
  y: number             // 0..1 normalized (0=top, 1=bottom)
  fontSize: number
  fontFamily: string
  color: string
  strokeColor: string
  strokeWidth: number
  backgroundColor: string
  animationIn: TextAnimation
  animationOut: TextAnimation
  animationDuration: number  // frames for in/out animation
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

// ─── Subtitles ──────────────────────────────────────────────────────────────
export interface SubtitleWord {
  text: string
  startSeconds: number
  endSeconds: number
}

export interface Subtitle {
  id: string
  text: string
  startSeconds: number
  endSeconds: number
  words?: SubtitleWord[]  // word-level timestamps for karaoke mode
}

export type SubtitleAnimation = 'none' | 'fadeIn' | 'slideUp' | 'bounce' | 'pop'

export interface SubtitleConfig {
  enabled: boolean
  subtitles: Subtitle[]
  fontFamily: string
  fontSize: number
  color: string
  strokeColor: string
  strokeWidth: number
  position: 'top' | 'center' | 'bottom'
  animationIn: SubtitleAnimation
  backgroundBox: boolean
  backgroundBoxColor?: string    // hex, default '#000000'
  backgroundBoxOpacity?: number  // 0-100, default 60
  karaokeStyle?: boolean
  karaokeHighlightColor?: string // hex, default '#FFD700'
}

// ─── Clips ──────────────────────────────────────────────────────────────────
export type ClipType = 'image' | 'title'

interface BaseClip {
  id: string
  type: ClipType
  durationFrames: number
  transitionIn: TransitionConfig
  textOverlays: TextOverlay[]
}

export type ImageFitMode = 'cover' | 'contain' | 'fill'

export interface ImageClipConfig extends BaseClip {
  type: 'image'
  mediaId: string
  mediaUrl: string
  kenBurns: KenBurnsConfig
  brightness: number   // -1..1
  contrast: number     // -1..1
  saturation: number   // -1..1
  // Static framing (applied before Ken Burns)
  rotation: number     // degrees, 0 = none
  cropZoom: number     // 1.0 = default, >1 zoom in, <1 zoom out
  cropX: number        // -1..1 horizontal offset
  cropY: number        // -1..1 vertical offset
  fitMode: ImageFitMode  // how image fills the frame
}

export interface TitleClipConfig extends BaseClip {
  type: 'title'
  text: string
  subtext?: string
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  backgroundMediaId?: string
  backgroundMediaUrl?: string
  animationIn: TextAnimation
  animationOut: TextAnimation
}

export type ClipConfig = ImageClipConfig | TitleClipConfig

// ─── Audio ──────────────────────────────────────────────────────────────────
export interface AudioTrackConfig {
  mediaId: string
  mediaUrl: string
  startFromSeconds: number
  volume: number
  fadeInFrames: number
  fadeOutFrames: number
}

// ─── Video config ────────────────────────────────────────────────────────────
export type VideoResolution = '1080x1920' | '1920x1080' | '1080x1080' | '720x1280' | '1280x720'

export interface VideoConfig {
  id: string
  name: string
  resolution: VideoResolution
  fps: 24 | 30 | 60
  clips: ClipConfig[]
  audioTrack: AudioTrackConfig | null
  subtitleConfig: SubtitleConfig | null
  totalFrames: number
}

// ─── Defaults ───────────────────────────────────────────────────────────────
export const DEFAULT_KEN_BURNS: KenBurnsConfig = {
  startX: 0, startY: 0, startScale: 1.0,
  endX: 0,   endY: 0,   endScale: 1.0,
  easing: 'easeInOut',
}

export const DEFAULT_TRANSITION: TransitionConfig = {
  type: 'crossfade',
  durationFrames: 15,
}

export const DEFAULT_TEXT_OVERLAY: Omit<TextOverlay, 'id' | 'text'> = {
  startFrame: 0,
  durationFrames: 60,
  x: 0.5,
  y: 0.5,
  fontSize: 48,
  fontFamily: 'sans-serif',
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  backgroundColor: 'transparent',
  animationIn: 'fadeIn',
  animationOut: 'fadeIn',
  animationDuration: 15,
  align: 'center',
  bold: false,
  italic: false,
}
