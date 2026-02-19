// Mirror of frontend types needed by the backend renderer

export type TextAnimation =
  | 'none'
  | 'fadeIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'typewriter'
  | 'zoom'

export interface KenBurnsConfig {
  startX: number
  startY: number
  startScale: number
  endX: number
  endY: number
  endScale: number
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut'
}

export interface TransitionConfig {
  type: string
  durationFrames: number
}

export interface TextOverlay {
  id: string
  text: string
  startFrame: number
  durationFrames: number
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  strokeColor: string
  strokeWidth: number
  backgroundColor: string
  animationIn: TextAnimation
  animationOut: TextAnimation
  animationDuration: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

interface BaseClip {
  id: string
  type: 'image' | 'title'
  durationFrames: number
  transitionIn: TransitionConfig
  textOverlays: TextOverlay[]
}

export interface ImageClipConfig extends BaseClip {
  type: 'image'
  mediaId: string
  mediaUrl: string
  kenBurns: KenBurnsConfig
  brightness: number
  contrast: number
  saturation: number
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

export interface AudioTrackConfig {
  mediaId: string
  mediaUrl: string
  startFromSeconds: number
  volume: number
  fadeInFrames: number
  fadeOutFrames: number
}

export interface Subtitle {
  id: string
  text: string
  startSeconds: number
  endSeconds: number
}

export interface SubtitleConfig {
  enabled: boolean
  subtitles: Subtitle[]
  fontFamily: string
  fontSize: number
  color: string
  strokeColor: string
  strokeWidth: number
  position: 'top' | 'center' | 'bottom'
  typewriterEffect: boolean
  backgroundBox: boolean
}

export type VideoResolution = '1080x1920' | '1920x1080' | '1080x1080' | '720x1280' | '1280x720'

export interface VideoConfig {
  id: string
  name: string
  resolution: VideoResolution
  fps: 15 | 24 | 30 | 60
  clips: ClipConfig[]
  audioTrack: AudioTrackConfig | null
  subtitleConfig: SubtitleConfig | null
  totalFrames: number
}
