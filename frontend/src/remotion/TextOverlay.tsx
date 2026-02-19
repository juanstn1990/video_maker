import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import type { TextOverlay as TextOverlayConfig } from '../types/video'

interface Props {
  config: TextOverlayConfig
}

export const TextOverlayComponent: React.FC<Props> = ({ config }) => {
  const frame = useCurrentFrame()

  if (frame < config.startFrame || frame > config.startFrame + config.durationFrames) {
    return null
  }

  const localFrame = frame - config.startFrame
  const { animationDuration: animDur, durationFrames } = config
  const exitStart = durationFrames - animDur

  let entryOpacity = 1
  let entryY = 0
  let entryX = 0
  let entryScale = 1

  switch (config.animationIn) {
    case 'fadeIn':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideUp':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryY = interpolate(localFrame, [0, animDur], [40, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideDown':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryY = interpolate(localFrame, [0, animDur], [-40, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideLeft':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryX = interpolate(localFrame, [0, animDur], [60, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'slideRight':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryX = interpolate(localFrame, [0, animDur], [-60, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'zoom':
      entryOpacity = interpolate(localFrame, [0, animDur], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      entryScale = interpolate(localFrame, [0, animDur], [0.5, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      break

    case 'bounce': {
      entryOpacity = interpolate(localFrame, [0, Math.max(1, animDur * 0.3)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const t1 = animDur * 0.55
      const t2 = animDur * 0.8
      const t3 = animDur
      if (localFrame <= t1) {
        entryY = interpolate(localFrame, [0, t1], [80, -14], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else if (localFrame <= t2) {
        entryY = interpolate(localFrame, [t1, t2], [-14, 6], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else {
        entryY = interpolate(localFrame, [t2, t3], [6, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      }
      break
    }

    case 'pop': {
      entryOpacity = interpolate(localFrame, [0, Math.max(1, animDur * 0.25)], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
      const peak = animDur * 0.6
      if (localFrame <= peak) {
        entryScale = interpolate(localFrame, [0, peak], [0.2, 1.25], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      } else {
        entryScale = interpolate(localFrame, [peak, animDur], [1.25, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
      }
      break
    }

    case 'glitch': {
      const progress = Math.min(1, localFrame / Math.max(1, animDur))
      const intensity = (1 - progress) * 10
      entryX = Math.sin(localFrame * 2.3) * intensity
      entryY = Math.sin(localFrame * 1.7 + 1) * intensity * 0.4
      entryOpacity = progress < 0.2
        ? interpolate(localFrame, [0, animDur * 0.2], [0.4, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
        : 1
      break
    }
  }

  // Typewriter: show characters progressively
  const visibleText = config.animationIn === 'typewriter'
    ? config.text.slice(
        0,
        Math.floor(interpolate(localFrame, [0, animDur], [0, config.text.length], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })),
      )
    : config.text

  // Exit opacity
  let exitOpacity = 1
  if (localFrame > exitStart && config.animationOut !== 'none') {
    exitOpacity = interpolate(localFrame, [exitStart, durationFrames], [1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  }

  const opacity = Math.min(entryOpacity, exitOpacity)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: `${config.y * 100}%`,
          left: `${config.x * 100}%`,
          transform: `translate(-50%, -50%) translate(${entryX}px, ${entryY}px) scale(${entryScale})`,
          opacity,
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          color: config.color,
          fontWeight: config.bold ? 'bold' : 'normal',
          fontStyle: config.italic ? 'italic' : 'normal',
          textAlign: config.align,
          WebkitTextStroke: config.strokeWidth > 0 ? `${config.strokeWidth}px ${config.strokeColor}` : 'none',
          backgroundColor: config.backgroundColor,
          padding: config.backgroundColor !== 'transparent' ? '4px 12px' : '0',
          borderRadius: config.backgroundColor !== 'transparent' ? '4px' : '0',
          userSelect: 'none',
          whiteSpace: 'pre-wrap',
          maxWidth: '80%',
          lineHeight: 1.2,
        }}
      >
        {visibleText || '\u200B'}
      </div>
    </AbsoluteFill>
  )
}
