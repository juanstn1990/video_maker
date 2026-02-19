import { Composition, registerRoot } from 'remotion'
import { VideoSlideshow } from './VideoSlideshow'
import type { VideoConfig } from '../types/video'

const defaultConfig: VideoConfig = {
  id: 'default',
  name: 'My Video',
  resolution: '1080x1920',
  fps: 30,
  clips: [],
  audioTrack: null,
  subtitleConfig: null,
  totalFrames: 90,
}

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoSlideshow"
      component={VideoSlideshow as unknown as React.ComponentType<Record<string, unknown>>}
      durationInFrames={defaultConfig.totalFrames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ config: defaultConfig } as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const cfg = (props as { config: VideoConfig }).config
        const [w, h] = cfg.resolution.split('x').map(Number)
        return {
          durationInFrames: Math.max(1, cfg.totalFrames),
          fps: cfg.fps,
          width: w,
          height: h,
        }
      }}
    />
  )
}

registerRoot(RemotionRoot)
