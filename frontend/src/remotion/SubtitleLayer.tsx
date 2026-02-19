import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SubtitleConfig, Subtitle } from '../types/video'

interface Props {
  config: SubtitleConfig
}

function getActiveSubtitle(subtitles: Subtitle[], currentSeconds: number): Subtitle | null {
  return subtitles.find(
    (s) => currentSeconds >= s.startSeconds && currentSeconds <= s.endSeconds,
  ) ?? null
}

interface SubtitleItemProps {
  subtitle: Subtitle
  config: SubtitleConfig
  fps: number
  // Frame relative to when this subtitle became active
  activeFrame: number
}

const SubtitleItem: React.FC<SubtitleItemProps> = ({ subtitle, config, fps, activeFrame }) => {
  const subtitleDurationFrames = Math.round((subtitle.endSeconds - subtitle.startSeconds) * fps)
  const animDur = Math.min(12, Math.floor(subtitleDurationFrames * 0.25))

  const isTypewriter = config.animationIn === 'none' && (config as any).typewriterEffect
  const elapsed = activeFrame / fps
  const duration = subtitle.endSeconds - subtitle.startSeconds

  // Typewriter character reveal
  const visibleText = isTypewriter || config.animationIn === 'none'
    ? subtitle.text
    : subtitle.text

  // Typewriter built into 'none' fallback for backward compat
  const typewriterText = (config as any).typewriterEffect
    ? subtitle.text.slice(0, Math.floor((elapsed / duration) * subtitle.text.length))
    : subtitle.text

  // Entry animation
  let entryOpacity = 1
  let entryY = 0
  let entryScale = 1

  const anim = config.animationIn ?? 'fadeIn'

  switch (anim) {
    case 'fadeIn':
      entryOpacity = interpolate(activeFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideUp':
      entryOpacity = interpolate(activeFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryY = interpolate(activeFrame, [0, animDur], [30, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'bounce': {
      entryOpacity = interpolate(activeFrame, [0, Math.max(1, animDur * 0.4)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const t1 = animDur * 0.55
      const t2 = animDur * 0.8
      if (activeFrame <= t1) {
        entryY = interpolate(activeFrame, [0, t1], [40, -8], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else if (activeFrame <= t2) {
        entryY = interpolate(activeFrame, [t1, t2], [-8, 3], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else {
        entryY = interpolate(activeFrame, [t2, animDur], [3, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      }
      break
    }

    case 'pop': {
      entryOpacity = interpolate(activeFrame, [0, Math.max(1, animDur * 0.3)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const peak = animDur * 0.6
      entryScale = activeFrame <= peak
        ? interpolate(activeFrame, [0, peak], [0.3, 1.2], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
        : interpolate(activeFrame, [peak, animDur], [1.2, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
      break
    }

    case 'none':
    default:
      break
  }

  const positionStyle: React.CSSProperties =
    config.position === 'top'
      ? { top: 80 }
      : config.position === 'center'
        ? { top: '50%', transform: `translateY(calc(-50% + ${entryY}px)) scale(${entryScale})` }
        : { bottom: 80 }

  // For non-center, apply transform separately
  const transformStyle: React.CSSProperties = config.position !== 'center'
    ? { transform: `translateY(${entryY}px) scale(${entryScale})` }
    : {}

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        opacity: entryOpacity,
        ...positionStyle,
        ...transformStyle,
      }}
    >
      <div
        style={{
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          color: config.color,
          WebkitTextStroke: config.strokeWidth > 0
            ? `${config.strokeWidth}px ${config.strokeColor}`
            : 'none',
          textAlign: 'center',
          lineHeight: 1.4,
          backgroundColor: config.backgroundBox ? 'rgba(0,0,0,0.6)' : 'transparent',
          padding: config.backgroundBox ? '8px 16px' : '0',
          borderRadius: config.backgroundBox ? '6px' : '0',
          maxWidth: '90%',
        }}
      >
        {typewriterText || '\u200B'}
      </div>
    </div>
  )
}

export const SubtitleLayer: React.FC<Props> = ({ config }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (!config.enabled || config.subtitles.length === 0) return null

  const currentSeconds = frame / fps
  const active = getActiveSubtitle(config.subtitles, currentSeconds)

  if (!active) return null

  const activeFrame = Math.round((currentSeconds - active.startSeconds) * fps)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <SubtitleItem
        key={active.id}
        subtitle={active}
        config={config}
        fps={fps}
        activeFrame={activeFrame}
      />
    </AbsoluteFill>
  )
}
