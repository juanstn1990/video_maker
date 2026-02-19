import { Player } from '@remotion/player'
import { VideoSlideshow } from '../../remotion/VideoSlideshow'
import { useEditorStore } from '../../store/useEditorStore'
import { useTimelineStore } from '../../store/useTimelineStore'
import { useRef, useEffect } from 'react'
import type { PlayerRef } from '@remotion/player'

export function VideoPreview() {
  const config = useEditorStore((s) => s.config)
  const { currentFrame, setCurrentFrame } = useTimelineStore()
  const playerRef = useRef<PlayerRef>(null)
  const [w, h] = config.resolution.split('x').map(Number)
  const totalFrames = Math.max(1, config.totalFrames)

  // Sync player to timeline scrubber
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(currentFrame)
    }
  }, [currentFrame])

  const aspect = w / h
  // Determine preview container dimensions keeping aspect ratio
  const previewStyle =
    aspect >= 1
      ? { width: '100%', aspectRatio: `${w}/${h}` }
      : { height: '100%', aspectRatio: `${w}/${h}` }

  if (totalFrames <= 1 && config.clips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-gray-500 text-sm">Agrega imágenes para comenzar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden p-2">
      <div style={previewStyle} className="max-h-full max-w-full shadow-2xl">
        <Player
          ref={playerRef}
          component={VideoSlideshow}
          durationInFrames={totalFrames}
          fps={config.fps}
          compositionWidth={w}
          compositionHeight={h}
          inputProps={{ config }}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  )
}
