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
  const [quality, setQuality] = useState<ExportQuality>('high')
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
                <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 cursor-pointer select-none">
                  <div
                    onClick={() => setQuality((v) => v === 'high' ? 'medium' : 'high')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${quality === 'medium' ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${quality === 'medium' ? 'translate-x-5' : ''}`} />
                  </div>
                  <div onClick={() => setQuality((v) => v === 'high' ? 'medium' : 'high')}>
                    <p className="text-sm font-medium text-white">
                      {quality === 'high' ? 'Calidad alta' : 'Calidad media'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {quality === 'high'
                        ? 'Máxima calidad · archivo mayor'
                        : 'Archivo más pequeño · renderizado más rápido'}
                    </p>
                  </div>
                </label>
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
