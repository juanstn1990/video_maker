import { useEditorStore } from '../../store/useEditorStore'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { VideoResolution } from '../../types/video'

const RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: '1080x1920', label: '1080×1920 (Vertical 9:16)' },
  { value: '1920x1080', label: '1920×1080 (Horizontal 16:9)' },
  { value: '1080x1080', label: '1080×1080 (Cuadrado 1:1)' },
  { value: '720x1280', label: '720×1280 (Vertical HD)' },
  { value: '1280x720', label: '1280×720 (Horizontal HD)' },
]

const FPS_OPTIONS = [
  { value: '15', label: '15 FPS (render rápido)' },
  { value: '24', label: '24 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
]

export function VideoSettingsPanel() {
  const { config, updateSettings } = useEditorStore()

  return (
    <div className="space-y-4 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configuración</h3>

      <Input
        label="Nombre del proyecto"
        value={config.name}
        onChange={(e) => updateSettings({ name: e.target.value })}
      />

      <Select
        label="Resolución"
        value={config.resolution}
        options={RESOLUTIONS}
        onChange={(e) => updateSettings({ resolution: e.target.value as VideoResolution })}
      />

      <Select
        label="FPS"
        value={String(config.fps)}
        options={FPS_OPTIONS}
        onChange={(e) => updateSettings({ fps: Number(e.target.value) as 15 | 24 | 30 | 60 })}
      />

      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500">
          Total: {config.clips.length} clips •{' '}
          {Math.round((config.totalFrames / config.fps) * 10) / 10}s
        </p>
      </div>
    </div>
  )
}
