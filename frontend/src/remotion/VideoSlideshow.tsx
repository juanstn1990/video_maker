import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { VideoConfig, ClipConfig } from '../types/video'
import { GOOGLE_FONTS_URL } from '../constants/fonts'
import { ImageSlide } from './ImageSlide'
import { TitleSlide } from './TitleSlide'
import { TextOverlayComponent } from './TextOverlay'
import { SubtitleLayer } from './SubtitleLayer'
import { computeClipTimings } from './utils/timing'

// Inject Google Fonts link once per document (works in preview; Chromium loads from cache on render)
if (typeof document !== 'undefined' && !document.getElementById('gf-video-maker')) {
  const link = document.createElement('link')
  link.id = 'gf-video-maker'
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_URL
  document.head.appendChild(link)
}

interface Props {
  config: VideoConfig
}

// Applies the transition-in animation to the entire clip container.
// This replaces the old Transition overlay approach, which was broken
// (crossfade used backgroundColor:'transparent' = invisible).
const ClipContainer: React.FC<{ clip: ClipConfig; index: number; children: React.ReactNode }> = ({
  clip,
  index,
  children,
}) => {
  const frame = useCurrentFrame()
  const t = clip.transitionIn

  if (t.type === 'none' || index === 0 || t.durationFrames === 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>
  }

  const progress = interpolate(frame, [0, t.durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  let style: React.CSSProperties = {}
  switch (t.type) {
    case 'crossfade':
    case 'fade':
      style = { opacity: progress }
      break
    case 'slideLeft':
      style = { transform: `translateX(${(1 - progress) * 100}%)` }
      break
    case 'slideRight':
      style = { transform: `translateX(${-(1 - progress) * 100}%)` }
      break
    case 'slideUp':
      style = { transform: `translateY(${(1 - progress) * 100}%)` }
      break
    case 'slideDown':
      style = { transform: `translateY(${-(1 - progress) * 100}%)` }
      break
    case 'zoomIn':
      style = { opacity: progress, transform: `scale(${1.3 - 0.3 * progress})` }
      break
    case 'zoomOut':
      style = { opacity: progress, transform: `scale(${0.7 + 0.3 * progress})` }
      break
    case 'wipeLeft':
      style = { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }
      break
    case 'wipeRight':
      style = { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` }
      break
    default:
      style = {}
  }

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

export const VideoSlideshow: React.FC<Props> = ({ config }) => {
  const { fps } = useVideoConfig()
  const timings = computeClipTimings(config.clips)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* Audio track */}
      {config.audioTrack && (
        <Audio
          src={config.audioTrack.mediaUrl}
          startFrom={Math.round(config.audioTrack.startFromSeconds * fps)}
          volume={(frame) => {
            const track = config.audioTrack!
            const totalFrames = config.totalFrames
            const fadeIn = track.fadeInFrames
            const fadeOut = track.fadeOutFrames

            if (frame < fadeIn && fadeIn > 0) {
              return (frame / fadeIn) * track.volume
            }
            if (frame > totalFrames - fadeOut && fadeOut > 0) {
              return ((totalFrames - frame) / fadeOut) * track.volume
            }
            return track.volume
          }}
        />
      )}

      {/* Clips */}
      {config.clips.map((clip, index) => {
        const { startFrame, durationFrames } = timings[index]

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <ClipContainer clip={clip} index={index}>
              {clip.type === 'image' ? (
                <ImageSlide clip={clip} />
              ) : (
                <TitleSlide clip={clip} />
              )}

              {/* Text overlays for this clip */}
              {clip.textOverlays.map((overlay) => (
                <TextOverlayComponent key={overlay.id} config={overlay} />
              ))}
            </ClipContainer>
          </Sequence>
        )
      })}

      {/* Global subtitles layer */}
      {config.subtitleConfig?.enabled && (
        <SubtitleLayer config={config.subtitleConfig} />
      )}
    </AbsoluteFill>
  )
}
