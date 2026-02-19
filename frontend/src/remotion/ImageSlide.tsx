import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import type { ImageClipConfig } from '../types/video'
import { applyKenBurns } from './utils/kenBurns'

interface Props {
  clip: ImageClipConfig
}

export const ImageSlide: React.FC<Props> = ({ clip }) => {
  const frame = useCurrentFrame()
  const { scale: kbScale, translateX: kbTx, translateY: kbTy } = applyKenBurns(
    clip.kenBurns,
    frame,
    clip.durationFrames,
  )

  // Static framing (crop/zoom/rotate) applied on top of Ken Burns
  const cropZoom = clip.cropZoom ?? 1
  const cropX = clip.cropX ?? 0
  const cropY = clip.cropY ?? 0
  const rotation = clip.rotation ?? 0

  const effectiveScale = kbScale * cropZoom
  // Offsets: convert from normalized (-1..1) to screen % divided by effectiveScale
  const effectiveTx = kbTx + (cropX * 100) / effectiveScale
  const effectiveTy = kbTy + (cropY * 100) / effectiveScale

  const filters = [
    clip.brightness !== 0 ? `brightness(${1 + clip.brightness})` : '',
    clip.contrast !== 0 ? `contrast(${1 + clip.contrast})` : '',
    clip.saturation !== 0 ? `saturate(${1 + clip.saturation})` : '',
  ].filter(Boolean).join(' ') || 'none'

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Img
        src={clip.mediaUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `rotate(${rotation}deg) scale(${effectiveScale}) translate(${effectiveTx}%, ${effectiveTy}%)`,
          transformOrigin: 'center center',
          filter: filters,
          willChange: 'transform',
        }}
      />
    </AbsoluteFill>
  )
}
