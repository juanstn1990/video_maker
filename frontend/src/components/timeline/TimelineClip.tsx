import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '../../store/useEditorStore'
import { useTimelineStore } from '../../store/useTimelineStore'
import type { ClipConfig } from '../../types/video'
import { useRef } from 'react'

interface Props {
  clip: ClipConfig
  index: number
  zoom: number  // px per frame
}

export function TimelineClip({ clip, index, zoom }: Props) {
  const { removeClip, updateClipDuration } = useEditorStore()
  const { selectedClipId, selectClip } = useTimelineStore()
  const isSelected = selectedClipId === clip.id
  const widthPx = Math.max(40, clip.durationFrames * zoom)
  const resizeRef = useRef<{ startX: number; startFrames: number } | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  })

  const style = {
    width: widthPx,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function onResizeStart(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startFrames: clip.durationFrames }

    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const dx = e.clientX - resizeRef.current.startX
      const newFrames = Math.max(15, Math.round(resizeRef.current.startFrames + dx / zoom))
      updateClipDuration(clip.id, newFrames)
    }

    function onUp() {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const bgColor = clip.type === 'image' ? 'bg-indigo-800' : 'bg-purple-800'
  const borderColor = isSelected ? 'border-white' : 'border-transparent'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative h-12 rounded flex-shrink-0 flex items-center select-none border-2 ${bgColor} ${borderColor} cursor-pointer`}
      onClick={() => selectClip(isSelected ? null : clip.id)}
      {...attributes}
      {...listeners}
    >
      {/* Thumbnail or label */}
      <div className="flex-1 overflow-hidden px-2">
        {clip.type === 'image' && clip.mediaUrl ? (
          <img
            src={clip.mediaUrl}
            alt=""
            className="h-9 w-full object-cover rounded pointer-events-none"
            draggable={false}
          />
        ) : (
          <span className="text-white text-xs truncate font-medium">
            {clip.type === 'title' ? clip.text : 'Imagen'}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        className="absolute top-0.5 right-5 text-white/60 hover:text-white text-xs leading-none"
        onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
      >
        ✕
      </button>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
        onMouseDown={onResizeStart}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
