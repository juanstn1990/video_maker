import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useEditorStore } from '../../store/useEditorStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useTimelineStore } from '../../store/useTimelineStore'
import { TimelineClip } from './TimelineClip'
import { Button } from '../ui/Button'
import { useRef, useState } from 'react'
import { AudioWaveform } from './AudioWaveform'

export function Timeline() {
  const { config, reorderClips, addImageClips, setAudioTrack } = useEditorStore()
  const { getMedia } = useMediaStore()
  const { zoom, setZoom, currentFrame, setCurrentFrame } = useTimelineStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const totalPx = config.totalFrames * zoom
  const fps = config.fps

  const [audioDragOver, setAudioDragOver] = useState(false)
  const [clipsDragOver, setClipsDragOver] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIdx = config.clips.findIndex((c) => c.id === active.id)
    const toIdx = config.clips.findIndex((c) => c.id === over.id)
    if (fromIdx !== -1 && toIdx !== -1) reorderClips(fromIdx, toIdx)
  }

  function onRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
    setCurrentFrame(Math.round(x / zoom))
  }

  // Handle image drops onto the clips track
  function onClipsDrop(e: React.DragEvent) {
    e.preventDefault()
    setClipsDragOver(false)
    const raw = e.dataTransfer.getData('images-data')
    if (!raw) return
    try {
      const items = JSON.parse(raw) as Array<{ mediaId: string; url: string }>
      addImageClips(items.map((i) => ({ mediaId: i.mediaId, mediaUrl: i.url })))
    } catch {}
  }

  // Handle audio drops onto the audio strip
  function onAudioDrop(e: React.DragEvent) {
    e.preventDefault()
    setAudioDragOver(false)
    const mediaId = e.dataTransfer.getData('audio-media-id')
    const url = e.dataTransfer.getData('audio-url')
    if (!mediaId || !url) return
    setAudioTrack({ mediaId, mediaUrl: url, startFromSeconds: 0, volume: 1, fadeInFrames: 15, fadeOutFrames: 30 })
  }

  const scrubberLeft = currentFrame * zoom

  // Find audio filename from media store
  const audioMedia = config.audioTrack ? getMedia(config.audioTrack.mediaId) : null

  return (
    <div className="flex flex-col bg-gray-900 border-t border-gray-800 flex-shrink-0" style={{ height: 200 }}>
      {/* Controls row */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-400">Timeline</span>
        <span className="text-xs text-gray-600 ml-2">
          {Math.round(currentFrame / fps * 10) / 10}s / {Math.round(config.totalFrames / fps * 10) / 10}s
        </span>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setZoom(zoom / 1.5)}>−</Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(zoom * 1.5)}>+</Button>
        </div>
      </div>

      {/* Scrollable clips area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden relative" ref={scrollRef}>
        <div style={{ width: Math.max(totalPx + 64, 400), minHeight: '100%', position: 'relative' }}>

          {/* Ruler */}
          <div
            className="h-5 bg-gray-950 border-b border-gray-800 cursor-crosshair relative select-none"
            onClick={onRulerClick}
          >
            {Array.from({ length: Math.ceil(config.totalFrames / fps) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: i * fps * zoom }}
              >
                <div className="w-px h-3 bg-gray-600" />
                <span className="text-gray-500 text-[9px] mt-0.5">{i}s</span>
              </div>
            ))}
          </div>

          {/* Clips drop zone + sortable list */}
          <div
            className={`flex items-center gap-1 px-1 py-1 h-[calc(100%-20px)] transition-colors ${
              clipsDragOver ? 'bg-indigo-950/40' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setClipsDragOver(true) }}
            onDragLeave={() => setClipsDragOver(false)}
            onDrop={onClipsDrop}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={config.clips.map((c) => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                {config.clips.map((clip, index) => (
                  <TimelineClip key={clip.id} clip={clip} index={index} zoom={zoom} />
                ))}
              </SortableContext>
            </DndContext>

            {config.clips.length === 0 && !clipsDragOver && (
              <p className="text-xs text-gray-600 ml-2">Agrega clips o arrastra imágenes aquí</p>
            )}
            {clipsDragOver && (
              <p className="text-xs text-indigo-400 ml-2">Suelta para agregar imágenes</p>
            )}
          </div>

          {/* Scrubber */}
          <div
            className="absolute top-0 bottom-0 w-px bg-yellow-400 pointer-events-none z-10"
            style={{ left: scrubberLeft }}
          />
        </div>
      </div>

      {/* Audio track row */}
      <div
        className={`flex-shrink-0 border-t transition-colors ${
          audioDragOver
            ? 'border-green-500 bg-green-900/30'
            : 'border-gray-800 bg-gray-950'
        } ${config.audioTrack ? 'h-14' : 'h-8'}`}
        onDragOver={(e) => { e.preventDefault(); setAudioDragOver(true) }}
        onDragLeave={() => setAudioDragOver(false)}
        onDrop={onAudioDrop}
      >
        {config.audioTrack ? (
          <div className="relative w-full h-full">
            {/* Waveform background */}
            <div className="absolute inset-0 px-8">
              <AudioWaveform audioUrl={config.audioTrack.mediaUrl} />
            </div>
            {/* Overlay with filename and controls */}
            <div className="absolute inset-0 flex items-center px-3 gap-2 text-xs">
              <span className="text-green-400 flex-shrink-0 drop-shadow">♪</span>
              <span
                className="text-green-200 truncate font-medium drop-shadow"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {audioMedia?.filename ?? config.audioTrack.mediaId}
              </span>
              <button
                className="ml-auto text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 bg-gray-900/60 rounded px-1"
                onClick={() => setAudioTrack(null)}
                title="Quitar audio"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center px-3 gap-2 h-full text-xs">
            <span className="text-green-400 flex-shrink-0">♪</span>
            <span className="text-gray-600 italic">
              {audioDragOver ? 'Suelta para establecer audio' : 'Arrastra un audio aquí'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
