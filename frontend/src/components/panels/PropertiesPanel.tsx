import { useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { useTimelineStore } from '../../store/useTimelineStore'
import { ImageClipPanel } from './ImageClipPanel'
import { TitleClipPanel } from './TitleClipPanel'
import { AudioPanel } from './AudioPanel'
import { VideoSettingsPanel } from './VideoSettingsPanel'
import { SubtitlePanel } from './SubtitlePanel'
import { clsx } from 'clsx'

type Tab = 'clip' | 'audio' | 'subtitles' | 'settings'

export function PropertiesPanel() {
  const { config } = useEditorStore()
  const { selectedClipId } = useTimelineStore()
  const [tab, setTab] = useState<Tab>('clip')

  const selectedClip = selectedClipId
    ? config.clips.find((c) => c.id === selectedClipId)
    : null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'clip', label: 'Clip' },
    { id: 'audio', label: 'Audio' },
    { id: 'subtitles', label: 'Subtít.' },
    { id: 'settings', label: 'Config' },
  ]

  return (
    <aside className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-[300px] flex-shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={clsx(
              'flex-1 py-2 text-xs font-medium transition-colors',
              tab === t.id
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'clip' && (
          <>
            {!selectedClip && (
              <p className="text-xs text-gray-500 p-4">
                Selecciona un clip en el timeline para editar sus propiedades.
              </p>
            )}
            {selectedClip?.type === 'image' && <ImageClipPanel clip={selectedClip} />}
            {selectedClip?.type === 'title' && <TitleClipPanel clip={selectedClip} />}
          </>
        )}
        {tab === 'audio' && <AudioPanel />}
        {tab === 'subtitles' && <SubtitlePanel />}
        {tab === 'settings' && <VideoSettingsPanel />}
      </div>
    </aside>
  )
}
