import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import type { TransitionType } from '../types/video'

interface Props {
  type: TransitionType
  durationFrames: number
}

export const Transition: React.FC<Props> = ({ type, durationFrames }) => {
  const frame = useCurrentFrame()

  if (type === 'none' || frame >= durationFrames) return null

  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  if (type === 'crossfade') {
    // Incoming clip fades in over outgoing clip
    return (
      <AbsoluteFill
        style={{ backgroundColor: 'transparent', opacity: 1 - progress }}
      />
    )
  }

  if (type === 'fade') {
    // Fade through black
    const opacity = progress < 0.5
      ? interpolate(progress, [0, 0.5], [0, 1])
      : interpolate(progress, [0.5, 1], [1, 0])
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', opacity }} />
    )
  }

  if (type === 'slideLeft') {
    const x = interpolate(progress, [0, 1], [100, 0])
    return (
      <AbsoluteFill
        style={{ transform: `translateX(${x}%)`, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'slideRight') {
    const x = interpolate(progress, [0, 1], [-100, 0])
    return (
      <AbsoluteFill
        style={{ transform: `translateX(${x}%)`, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'slideUp') {
    const y = interpolate(progress, [0, 1], [100, 0])
    return (
      <AbsoluteFill
        style={{ transform: `translateY(${y}%)`, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'slideDown') {
    const y = interpolate(progress, [0, 1], [-100, 0])
    return (
      <AbsoluteFill
        style={{ transform: `translateY(${y}%)`, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'zoomIn') {
    const scale = interpolate(progress, [0, 1], [1.5, 1])
    const opacity = interpolate(progress, [0, 0.4], [0, 1], {
      extrapolateRight: 'clamp',
    })
    return (
      <AbsoluteFill
        style={{ transform: `scale(${scale})`, opacity, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'zoomOut') {
    const scale = interpolate(progress, [0, 1], [0.5, 1])
    const opacity = interpolate(progress, [0, 0.4], [0, 1], {
      extrapolateRight: 'clamp',
    })
    return (
      <AbsoluteFill
        style={{ transform: `scale(${scale})`, opacity, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'wipeLeft') {
    const pct = interpolate(progress, [0, 1], [100, 0])
    return (
      <AbsoluteFill
        style={{ clipPath: `inset(0 ${pct}% 0 0)`, backgroundColor: 'inherit' }}
      />
    )
  }

  if (type === 'wipeRight') {
    const pct = interpolate(progress, [0, 1], [100, 0])
    return (
      <AbsoluteFill
        style={{ clipPath: `inset(0 0 0 ${pct}%)`, backgroundColor: 'inherit' }}
      />
    )
  }

  return null
}
