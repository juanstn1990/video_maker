import { useRef, useState, type DragEvent } from 'react'
import { useMediaStore } from '../../store/useMediaStore'
import { useEditorStore } from '../../store/useEditorStore'
import { Button } from '../ui/Button'
import type { UploadedMedia } from '../../types/api'


async function uploadFile(file: File): Promise<UploadedMedia> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Error al subir archivo')
  const data = await res.json()
  return {
    mediaId: data.mediaId,
    filename: data.filename,
    url: data.url,
    type: data.type,
    width: data.width,
    height: data.height,
    thumbnailUrl: data.thumbnailUrl,
    durationSeconds: data.durationSeconds,
  }
}

export function MediaPanel() {
  const { items, addMedia, removeMedia } = useMediaStore()
  const { addImageClip, addImageClips, addVideoClip, addTitleClip, setAudioTrack, config } = useEditorStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Multi-select state for images
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const images = items.filter((m) => m.type === 'image')
  const videos = items.filter((m) => m.type === 'video')
  const audios = items.filter((m) => m.type === 'audio')

  async function handleFiles(files: FileList | File[]) {
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const media = await uploadFile(file)
        addMedia(media)
      } catch (e) {
        console.error(e)
      }
    }
    setUploading(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function toggleSelect(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(mediaId)) next.delete(mediaId)
      else next.add(mediaId)
      return next
    })
  }

  function addSelected() {
    const toAdd = images.filter((img) => selectedIds.has(img.mediaId))
    addImageClips(toAdd.map((img) => ({ mediaId: img.mediaId, mediaUrl: img.url })))
    setSelectedIds(new Set())
  }

  // When dragging images from the panel, carry all selected (or just this one)
  function onImageDragStart(e: DragEvent, img: UploadedMedia) {
    const toAdd =
      selectedIds.size > 0 && selectedIds.has(img.mediaId)
        ? images.filter((i) => selectedIds.has(i.mediaId))
        : [img]
    e.dataTransfer.setData(
      'images-data',
      JSON.stringify(toAdd.map((i) => ({ mediaId: i.mediaId, url: i.url }))),
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onVideoDragStart(e: DragEvent, vid: UploadedMedia) {
    e.dataTransfer.setData('video-media-id', vid.mediaId)
    e.dataTransfer.setData('video-url', vid.url)
    e.dataTransfer.setData('video-duration', String(vid.durationSeconds ?? 0))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onAudioDragStart(e: DragEvent, aud: UploadedMedia) {
    e.dataTransfer.setData('audio-media-id', aud.mediaId)
    e.dataTransfer.setData('audio-url', aud.url)
    e.dataTransfer.setData('audio-filename', aud.filename)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function deleteMedia(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    // If this audio is the active track, deactivate it first
    if (config.audioTrack?.mediaId === mediaId) setAudioTrack(null)
    removeMedia(mediaId)
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(mediaId); return next })
  }

  return (
    <aside className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-full md:w-[280px] flex-shrink-0">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Media</h2>

        {/* Drop zone for file upload */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-950/30' : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <p className="text-xs text-gray-400">
            {uploading ? 'Subiendo...' : (
              <>
                <span className="hidden md:inline">Arrastra imágenes, videos o audio aquí</span>
                <span className="inline md:hidden">Toca para subir media</span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            <span className="hidden md:inline">o haz click para seleccionar</span>
            <span className="inline md:hidden">JPG, PNG, MP4, MP3...</span>
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*,audio/*,.mpeg,.mpg,.mp3,.mp2,.m4a,.ogg,.wav,.flac,.aac,.opus"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Title clip */}
        <Button
          variant="secondary"
          size="sm"
          className="w-full mt-2"
          onClick={addTitleClip}
        >
          + Agregar Título
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Images */}
        {images.length > 0 && (
          <div>
            <div className="flex items-center mb-2 gap-2">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider">
                Imágenes ({images.length})
              </h3>
              <div className="ml-auto flex gap-1">
                {selectedIds.size > 0 ? (
                  <button
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2 py-0.5 transition-colors"
                    onClick={addSelected}
                  >
                    + Agregar {selectedIds.size}
                  </button>
                ) : (
                  <button
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2 py-0.5 transition-colors"
                    onClick={() => addImageClips(images.map((img) => ({ mediaId: img.mediaId, mediaUrl: img.url })))}
                  >
                    + Agregar todas
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mb-2 hidden md:block">
              Click → agregar · Checkbox → seleccionar · Drag → arrastrar al timeline
            </p>
            <p className="text-[10px] text-gray-600 mb-2 md:hidden">
              Toca → agregar · ✓ → seleccionar
            </p>
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
              {images.map((img) => {
                const isSelected = selectedIds.has(img.mediaId)
                return (
                  <div
                    key={img.mediaId}
                    className={`relative aspect-square rounded overflow-hidden border transition-colors group cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'border-indigo-400 ring-2 ring-indigo-500/50'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                    draggable
                    onDragStart={(e) => onImageDragStart(e, img)}
                    title={img.filename}
                  >
                    <img
                      src={img.thumbnailUrl ?? img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Click whole card → add to timeline */}
                    <div
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      onClick={() => addImageClip(img.mediaId, img.url)}
                    >
                      <span className="text-white text-xs font-medium">+ Agregar</span>
                    </div>

                    {/* Checkbox to toggle multi-select */}
                    <button
                      className={`absolute top-1 left-1 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all z-10 ${
                        isSelected
                          ? 'bg-indigo-500 text-white opacity-100'
                          : 'bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60'
                      }`}
                      onClick={(e) => toggleSelect(img.mediaId, e)}
                      title="Seleccionar"
                    >
                      {isSelected ? '✓' : '·'}
                    </button>

                    {/* Delete button — visible on hover (desktop) or always (touch) */}
                    <button
                      onClick={(e) => deleteMedia(img.mediaId, e)}
                      title="Eliminar"
                      className="absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-red-600/90 text-white text-xs font-bold opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-80 focus:opacity-100 active:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Videos ({videos.length})
            </h3>
            <p className="text-[10px] text-gray-600 mb-2 hidden md:block">
              Click → agregar · Drag → arrastrar al timeline
            </p>
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
              {videos.map((vid) => (
                <div
                  key={vid.mediaId}
                  className="relative aspect-square rounded overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors group cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => onVideoDragStart(e, vid)}
                  title={vid.filename}
                >
                  {vid.thumbnailUrl ? (
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-2xl">🎬</span>
                    </div>
                  )}

                  {/* Duration badge */}
                  {vid.durationSeconds != null && (
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white rounded px-1 py-0.5">
                      {Math.floor(vid.durationSeconds / 60)}:{String(Math.round(vid.durationSeconds % 60)).padStart(2, '0')}
                    </span>
                  )}

                  {/* Click overlay → add to timeline */}
                  <div
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={() => addVideoClip(vid.mediaId, vid.url, vid.durationSeconds ?? 0)}
                  >
                    <span className="text-white text-xs font-medium">+ Agregar</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteMedia(vid.mediaId, e)}
                    title="Eliminar"
                    className="absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-red-600/90 text-white text-xs font-bold opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-80 focus:opacity-100 active:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {audios.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Audio ({audios.length})
            </h3>
            <p className="text-[10px] text-gray-600 mb-2">
              Click → activar · Drag → soltar en barra de audio del timeline
            </p>
            <div className="space-y-1">
              {audios.map((aud) => {
                const isActive = config.audioTrack?.mediaId === aud.mediaId
                return (
                  <div
                    key={aud.mediaId}
                    className={`relative group w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 cursor-grab active:cursor-grabbing ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    draggable
                    onDragStart={(e) => onAudioDragStart(e, aud)}
                    onClick={() => {
                      if (isActive) {
                        setAudioTrack(null)
                      } else {
                        setAudioTrack({
                          mediaId: aud.mediaId,
                          mediaUrl: aud.url,
                          startFromSeconds: 0,
                          volume: 1,
                          fadeInFrames: 15,
                          fadeOutFrames: 30,
                        })
                      }
                    }}
                  >
                    <span className="text-base flex-shrink-0">{isActive ? '♪' : '♩'}</span>
                    <span className="truncate flex-1">{aud.filename}</span>
                    <button
                      onClick={(e) => deleteMedia(aud.mediaId, e)}
                      title="Eliminar"
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-600/90 text-white text-xs font-bold opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-4">
            Sube imágenes, videos o audio para comenzar
          </p>
        )}
      </div>
    </aside>
  )
}
