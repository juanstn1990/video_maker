import { useState, useEffect, useRef } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Button } from '../ui/Button'

type Phase = 'idle' | 'rendering' | 'done' | 'error'

export function ExportModal() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const config = useEditorStore((s) => s.config)

  function close() {
    if (phase === 'rendering') return  // can't close while rendering
    setOpen(false)
    setPhase('idle')
    setProgress(0)
    setMessage('')
    setJobId(null)
  }

  async function startRender() {
    setPhase('rendering')
    setProgress(0)
    setMessage('Enviando configuración...')

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error('Error al iniciar el render')
      const { jobId } = await res.json()
      setJobId(jobId)

      // Listen for SSE progress
      const es = new EventSource(`/api/progress/${jobId}`)
      esRef.current = es

      es.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setProgress(data.progress ?? 0)
        setMessage(data.message ?? '')
        if (data.status === 'completed') {
          setPhase('done')
          es.close()
        } else if (data.status === 'error' || data.status === 'cancelled') {
          setPhase('error')
          setMessage(data.message ?? 'Error desconocido')
          es.close()
        }
      }

      es.onerror = () => {
        setPhase('error')
        setMessage('Error de conexión con el servidor')
        es.close()
      }
    } catch (err) {
      setPhase('error')
      setMessage(String(err))
    }
  }

  async function cancelRender() {
    if (!jobId) return
    await fetch(`/api/cancel/${jobId}`, { method: 'POST' })
    esRef.current?.close()
    setPhase('error')
    setMessage('Renderizado cancelado')
  }

  function download() {
    if (!jobId) return
    window.location.href = `/api/download/${jobId}`
  }

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close() }, [])

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="primary" size="sm">
        Exportar Video
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[440px] shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">Exportar Video</h2>
            <p className="text-sm text-gray-400 mb-5">
              {config.name} · {config.resolution} · {config.fps}fps
            </p>

            {/* Progress bar */}
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
              </div>
            )}

            {phase === 'done' && (
              <div className="mb-5 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                <p className="text-green-400 text-sm font-medium">Video listo</p>
                <p className="text-green-600 text-xs mt-0.5">El render completó correctamente.</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Error</p>
                <p className="text-red-600 text-xs mt-0.5 break-all">{message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              {phase === 'idle' && (
                <>
                  <Button variant="ghost" onClick={close}>Cancelar</Button>
                  <Button variant="primary" onClick={startRender}>
                    Iniciar Render
                  </Button>
                </>
              )}
              {phase === 'rendering' && (
                <Button variant="danger" onClick={cancelRender}>
                  Cancelar
                </Button>
              )}
              {phase === 'done' && (
                <>
                  <Button variant="secondary" onClick={close}>Cerrar</Button>
                  <Button variant="primary" onClick={download}>
                    Descargar MP4
                  </Button>
                </>
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
