import { AbsoluteFill, Video, useVideoConfig } from 'remotion'
import type { VideoClipConfig } from '../types/video'

interface Props {
  clip: VideoClipConfig
}

export const VideoSlide: React.FC<Props> = ({ clip }) => {
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Video
        src={clip.mediaUrl}
        startFrom={Math.round(clip.startFromSeconds * fps)}
        volume={clip.muted ? 0 : clip.volume}
        style={{
          width: '100%',
          height: '100%',
          objectFit: clip.fitMode ?? 'cover',
        }}
      />
    </AbsoluteFill>
  )
}
