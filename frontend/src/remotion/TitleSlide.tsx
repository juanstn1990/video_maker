import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'
import type { TitleClipConfig } from '../types/video'

interface Props {
  clip: TitleClipConfig
}

export const TitleSlide: React.FC<Props> = ({ clip }) => {
  const frame = useCurrentFrame()
  const dur = clip.durationFrames
  const animDur = Math.min(20, Math.floor(dur * 0.3))

  let opacity = 1
  let translateY = 0
  let scale = 1
  let translateX = 0

  switch (clip.animationIn) {
    case 'fadeIn':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideUp':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      translateY = interpolate(frame, [0, animDur], [60, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideDown':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      translateY = interpolate(frame, [0, animDur], [-60, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideLeft':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      translateX = interpolate(frame, [0, animDur], [80, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideRight':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      translateX = interpolate(frame, [0, animDur], [-80, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'zoom':
      opacity = interpolate(frame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      scale = interpolate(frame, [0, animDur], [0.7, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'bounce': {
      opacity = interpolate(frame, [0, Math.max(1, animDur * 0.3)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const t1 = animDur * 0.55
      const t2 = animDur * 0.8
      if (frame <= t1) {
        translateY = interpolate(frame, [0, t1], [80, -14], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else if (frame <= t2) {
        translateY = interpolate(frame, [t1, t2], [-14, 6], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else {
        translateY = interpolate(frame, [t2, animDur], [6, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      }
      break
    }

    case 'pop': {
      opacity = interpolate(frame, [0, Math.max(1, animDur * 0.25)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const peak = animDur * 0.6
      scale = frame <= peak
        ? interpolate(frame, [0, peak], [0.2, 1.25], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
        : interpolate(frame, [peak, animDur], [1.25, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
      break
    }

    case 'glitch': {
      const progress = Math.min(1, frame / Math.max(1, animDur))
      const intensity = (1 - progress) * 12
      translateX = Math.sin(frame * 2.3) * intensity
      translateY = Math.sin(frame * 1.7 + 1) * intensity * 0.4
      opacity = progress < 0.2
        ? interpolate(frame, [0, animDur * 0.2], [0.4, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
        : 1
      break
    }
  }

  // Exit animation
  const exitStart = dur - animDur
  if (frame > exitStart && clip.animationOut !== 'none') {
    opacity = Math.min(opacity, interpolate(frame, [exitStart, dur], [1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    }))
  }

  const transform = `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`

  // Typewriter for title text
  const visibleText = clip.animationIn === 'typewriter'
    ? clip.text.slice(0, Math.floor(interpolate(frame, [0, animDur], [0, clip.text.length], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })))
    : clip.text

  return (
    <AbsoluteFill
      style={{
        backgroundColor: clip.backgroundMediaUrl ? 'transparent' : clip.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      {clip.backgroundMediaUrl && (
        <Img
          src={clip.backgroundMediaUrl}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '40px',
          opacity,
          transform,
        }}
      >
        <div
          style={{
            fontSize: clip.fontSize,
            fontFamily: clip.fontFamily,
            color: clip.color,
            fontWeight: 'bold',
            lineHeight: 1.2,
            textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          }}
        >
          {visibleText}
        </div>
        {clip.subtext && (
          <div
            style={{
              fontSize: clip.fontSize * 0.5,
              fontFamily: clip.fontFamily,
              color: clip.color,
              marginTop: 16,
              opacity: 0.85,
            }}
          >
            {clip.subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
