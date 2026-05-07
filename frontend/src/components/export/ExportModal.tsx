import { useState, useRef } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Button } from '../ui/Button'
import { exportVideo, downloadBuffer } from '../../renderer/exporter'
import type { ExportQuality, ExportProgress } from '../../renderer/exporter'

type Phase = 'idle' | 'rendering' | 'done' | 'error'

export function ExportModal() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [quality, setQuality] = useState<ExportQuality>('low')
  const abortRef = useRef<AbortController | null>(null)
  const { config, savedProjectId, setSavedProjectId } = useEditorStore()

  async function autoSave() {
    try {
      const body = JSON.stringify({ name: config.name, config })
      const r = savedProjectId
        ? await fetch(`/api/projects/${savedProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
        : await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
      if (r.ok) {
        const data = await r.json()
        setSavedProjectId(data.project.id)
      }
    } catch {
      // non-blocking
    }
  }

  function close() {
    if (phase === 'rendering') return
    setOpen(false)
    setPhase('idle')
    setProgress(0)
    setMessage('')
  }

  async function startRender() {
    setPhase('rendering')
    setProgress(0)
    setMessage('Guardando proyecto...')
    await autoSave()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const buffer = await exportVideo(
        config,
        quality,
        (p: ExportProgress) => {
          setProgress(Math.round(p.progress * 100))
          setMessage(p.message)
        },
        controller.signal,
      )

      setPhase('done')
      setMessage('Video listo')
      downloadBuffer(buffer, `${config.name || 'video'}.mp4`)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhase('error')
        setMessage('Exportación cancelada')
      } else {
        setPhase('error')
        setMessage(String(err))
      }
    }
  }

  function cancelRender() {
    abortRef.current?.abort()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="primary" size="sm">
        Exportar Video
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[440px] shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">Exportar Video</h2>
            <p className="text-sm text-gray-400 mb-3">
              {config.name} · {config.resolution} · {config.fps}fps
            </p>

            {phase === 'idle' && (
              <div className="mb-5 space-y-2">
                <p className="text-xs text-gray-400 mb-3">
                  El video se renderiza directamente en tu navegador — sin esperar al servidor.
                </p>
                {([
                  { value: 'high' as ExportQuality, label: 'Alta', fps: '30 fps', desc: 'Máxima calidad · archivo mayor' },
                  { value: 'medium' as ExportQuality, label: 'Media', fps: '15 fps', desc: 'Balance entre calidad y tamaño' },
                  { value: 'low' as ExportQuality, label: 'Baja', fps: '10 fps', desc: 'Archivo más pequeño · más rápido' },
                ] as const).map(({ value, label, fps, desc }) => (
                  <button
                    key={value}
                    onClick={() => setQuality(value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      quality === value
                        ? 'bg-indigo-900/40 border-indigo-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      quality === value ? 'border-indigo-500' : 'border-gray-500'
                    }`}>
                      {quality === value && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {label} <span className="text-gray-400 font-normal">· {fps}</span>
                      </p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {phase === 'rendering' && (
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{message}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Renderizando en tu navegador con WebCodecs
                </p>
              </div>
            )}

            {phase === 'done' && (
              <div className="mb-5 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                <p className="text-green-400 text-sm font-medium">Video listo</p>
                <p className="text-green-600 text-xs mt-0.5">La descarga comenzó automáticamente.</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Error</p>
                <p className="text-red-600 text-xs mt-0.5 break-all">{message}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              {phase === 'idle' && (
                <>
                  <Button variant="ghost" onClick={close}>Cancelar</Button>
                  <Button variant="primary" onClick={startRender}>Iniciar Render</Button>
                </>
              )}
              {phase === 'rendering' && (
                <Button variant="danger" onClick={cancelRender}>Cancelar</Button>
              )}
              {phase === 'done' && (
                <Button variant="secondary" onClick={close}>Cerrar</Button>
              )}
              {phase === 'error' && (
                <>
                  <Button variant="ghost" onClick={close}>Cerrar</Button>
                  <Button variant="secondary" onClick={() => { setPhase('idle'); setMessage('') }}>
                    Reintentar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
