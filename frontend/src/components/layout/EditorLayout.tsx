import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MediaPanel } from '../media/MediaPanel'
import { VideoPreview } from '../preview/VideoPreview'
import { Timeline } from '../timeline/Timeline'
import { PropertiesPanel } from '../panels/PropertiesPanel'
import { ExportModal } from '../export/ExportModal'
import { ProjectsModal } from '../projects/ProjectsModal'
import { useEditorStore } from '../../store/useEditorStore'
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

type MobileTab = 'media' | 'video' | 'props'

const TABS: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'media', label: 'Media', icon: '🖼' },
  { id: 'video', label: 'Video', icon: '▶' },
  { id: 'props', label: 'Ajustes', icon: '⚙' },
]

export function EditorLayout() {
  const navigate = useNavigate()
  const { config, savedProjectId, setSavedProjectId, updateSettings } = useEditorStore()
  const [activeTab, setActiveTab] = useState<MobileTab>('video')
  const [showProjects, setShowProjects] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = JSON.stringify({ name: config.name, config })
      let r: Response
      if (savedProjectId) {
        r = await fetch(`/api/projects/${savedProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      } else {
        r = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      }
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setSavedProjectId(data.project.id)
      setSaveMsg('Guardado')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: any) {
      setSaveMsg(err.message || 'Error al guardar')
      setTimeout(() => setSaveMsg(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-gray-100 overflow-hidden">
      {/* ─── Toolbar ─── */}
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-200 transition-colors text-xs flex items-center gap-1 flex-shrink-0"
        >
          ← Inicio
        </button>
        <div className="w-px h-4 bg-gray-700 flex-shrink-0" />
        <span className="text-indigo-400 font-bold text-sm tracking-tight flex-shrink-0">VM</span>

        <input
          className="bg-transparent border-none text-gray-200 text-xs font-medium focus:outline-none focus:bg-gray-800 rounded px-1 py-0.5 min-w-0 w-24 sm:w-36"
          value={config.name}
          onChange={(e) => updateSettings({ name: e.target.value })}
          title="Nombre del proyecto"
        />

        <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <select
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-1 sm:px-2 py-1 focus:outline-none max-w-[90px] sm:max-w-none"
            value={config.resolution}
            onChange={(e) => updateSettings({ resolution: e.target.value as VideoResolution })}
          >
            {RESOLUTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            className="hidden sm:block bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
            value={String(config.fps)}
            onChange={(e) => updateSettings({ fps: Number(e.target.value) as 24 | 30 | 60 })}
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 border border-gray-700 rounded px-2 py-1 transition-colors flex-shrink-0"
            title="Guardar proyecto"
          >
            {saving ? '...' : saveMsg ?? '💾'}
          </button>

          {/* Open projects */}
          <button
            onClick={() => setShowProjects(true)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded px-2 py-1 transition-colors flex-shrink-0"
            title="Mis proyectos"
          >
            📂
          </button>

          <ExportModal />
        </div>
      </header>

      {showProjects && <ProjectsModal onClose={() => setShowProjects(false)} />}

      {/* ─── Main area — desktop: 3 columns, mobile: single panel ─── */}

      {/* Desktop layout (md+) */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <MediaPanel />
        <div className="flex flex-col flex-1 overflow-hidden">
          <VideoPreview />
          <Timeline />
        </div>
        <PropertiesPanel />
      </div>

      {/* Mobile layout (< md) */}
      <div className="flex md:hidden flex-1 overflow-hidden flex-col">
        <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'media' ? 'flex' : 'hidden'}`}>
          <MediaPanel />
        </div>
        <div className={`flex-1 overflow-hidden flex-col ${activeTab === 'video' ? 'flex' : 'hidden'}`}>
          <VideoPreview />
          <Timeline />
        </div>
        <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'props' ? 'flex' : 'hidden'}`}>
          <PropertiesPanel />
        </div>

        {/* Bottom tab bar */}
        <nav className="flex-shrink-0 flex border-t border-gray-800 bg-gray-900">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-t-2 border-indigo-400'
                  : 'text-gray-500 border-t-2 border-transparent'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
