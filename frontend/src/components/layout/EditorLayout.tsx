import { MediaPanel } from '../media/MediaPanel'
import { VideoPreview } from '../preview/VideoPreview'
import { Timeline } from '../timeline/Timeline'
import { PropertiesPanel } from '../panels/PropertiesPanel'
import { ExportModal } from '../export/ExportModal'
import { useEditorStore } from '../../store/useEditorStore'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { VideoResolution } from '../../types/video'

const RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: '1080x1920', label: '9:16 Vertical' },
  { value: '1920x1080', label: '16:9 Horizontal' },
  { value: '1080x1080', label: '1:1 Cuadrado' },
  { value: '720x1280', label: '9:16 HD' },
  { value: '1280x720', label: '16:9 HD' },
]

const FPS_OPTIONS = [
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
  { value: '60', label: '60 fps' },
]

interface Props {
  onBack?: () => void
}

export function EditorLayout({ onBack }: Props) {
  const { config, updateSettings } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* ─── Toolbar ─── */}
      <header className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        {onBack && (
          <>
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-200 transition-colors text-xs flex items-center gap-1 flex-shrink-0"
            >
              ← Inicio
            </button>
            <div className="w-px h-4 bg-gray-700 flex-shrink-0" />
          </>
        )}
        <span className="text-indigo-400 font-bold text-sm tracking-tight mr-2">VideoMaker</span>

        <input
          className="bg-transparent border-none text-gray-200 text-sm font-medium focus:outline-none focus:bg-gray-800 rounded px-1 py-0.5 w-36"
          value={config.name}
          onChange={(e) => updateSettings({ name: e.target.value })}
          title="Nombre del proyecto"
        />

        <div className="ml-auto flex items-center gap-2">
          <select
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
            value={config.resolution}
            onChange={(e) => updateSettings({ resolution: e.target.value as VideoResolution })}
          >
            {RESOLUTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
            value={String(config.fps)}
            onChange={(e) => updateSettings({ fps: Number(e.target.value) as 24 | 30 | 60 })}
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <ExportModal />
        </div>
      </header>

      {/* ─── Main area ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Media panel */}
        <MediaPanel />

        {/* Center: Preview + Timeline */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <VideoPreview />
          <Timeline />
        </div>

        {/* Right: Properties panel */}
        <PropertiesPanel />
      </div>
    </div>
  )
}
