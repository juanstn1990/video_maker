import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SubtitleConfig, Subtitle, SubtitleWord } from '../types/video'

interface Props {
  config: SubtitleConfig
}

function getActiveSubtitle(subtitles: Subtitle[], currentSeconds: number): Subtitle | null {
  return subtitles.find(
    (s) => currentSeconds >= s.startSeconds && currentSeconds <= s.endSeconds,
  ) ?? null
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${opacity / 100})`
}

interface SubtitleItemProps {
  subtitle: Subtitle
  config: SubtitleConfig
  fps: number
  // Frame relative to when this subtitle became active
  activeFrame: number
}

const KaraokeText: React.FC<{
  subtitle: Subtitle
  currentSeconds: number
  highlightColor: string
  baseColor: string
  fontFamily: string
  fontSize: number
  strokeWidth: number
  strokeColor: string
}> = ({ subtitle, currentSeconds, highlightColor, baseColor, fontFamily, fontSize, strokeWidth, strokeColor }) => {
  const words = subtitle.words

  // If no word-level data, fall back to a time-proportional sweep highlight
  if (!words || words.length === 0) {
    const duration = subtitle.endSeconds - subtitle.startSeconds
    const elapsed = currentSeconds - subtitle.startSeconds
    const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0

    const textStyle: React.CSSProperties = {
      background: `linear-gradient(to right, ${highlightColor} ${progress * 100}%, ${baseColor} ${progress * 100}%)`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : 'none',
      fontFamily,
      fontSize,
    }
    return <span style={textStyle}>{subtitle.text}</span>
  }

  // Word-by-word highlighting
  return (
    <span>
      {words.map((w: SubtitleWord, i: number) => {
        const sung = currentSeconds >= w.startSeconds
        return (
          <span
            key={i}
            style={{
              color: sung ? highlightColor : baseColor,
              WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : 'none',
              transition: 'color 0.04s',
            }}
          >
            {w.text}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </span>
  )
}

const SubtitleItem: React.FC<SubtitleItemProps> = ({ subtitle, config, fps, activeFrame }) => {
  const subtitleDurationFrames = Math.round((subtitle.endSeconds - subtitle.startSeconds) * fps)
  const animDur = Math.min(12, Math.floor(subtitleDurationFrames * 0.25))

  const currentSeconds = subtitle.startSeconds + (activeFrame / fps)

  // Typewriter built into 'none' fallback for backward compat
  const typewriterText = (config as any).typewriterEffect
    ? subtitle.text.slice(0, Math.floor(((activeFrame / fps) / (subtitle.endSeconds - subtitle.startSeconds)) * subtitle.text.length))
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

  const bgColor = config.backgroundBoxColor ?? '#000000'
  const bgOpacity = config.backgroundBoxOpacity !== undefined ? config.backgroundBoxOpacity : 60
  const backgroundColor = config.backgroundBox ? hexToRgba(bgColor, bgOpacity) : 'transparent'

  const isKaraoke = config.karaokeStyle ?? false
  const highlightColor = config.karaokeHighlightColor ?? '#FFD700'

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
          WebkitTextStroke: !isKaraoke && config.strokeWidth > 0
            ? `${config.strokeWidth}px ${config.strokeColor}`
            : 'none',
          textAlign: 'center',
          lineHeight: 1.4,
          backgroundColor,
          padding: config.backgroundBox ? '8px 16px' : '0',
          borderRadius: config.backgroundBox ? '6px' : '0',
          maxWidth: '90%',
        }}
      >
        {isKaraoke ? (
          <KaraokeText
            subtitle={subtitle}
            currentSeconds={currentSeconds}
            highlightColor={highlightColor}
            baseColor={config.color}
            fontFamily={config.fontFamily}
            fontSize={config.fontSize}
            strokeWidth={config.strokeWidth}
            strokeColor={config.strokeColor}
          />
        ) : (
          typewriterText || '\u200B'
        )}
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
