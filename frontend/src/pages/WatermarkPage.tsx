import { useRef, useState } from 'react'
import { Button } from '../components/ui/Button'

interface Props {
  onBack: () => void
}

type JobStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export function WatermarkPage({ onBack }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [intervalSecs, setIntervalSecs] = useState(8)
  const [volume, setVolume] = useState(1.2)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function handleFileChange(f: File | null) {
    if (!f) return
    setFile(f)
    setStatus('idle')
    setJobId(null)
    setMessage('')
    setProgress(0)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function handleProcess() {
    if (!file) return
    setStatus('uploading')
    setProgress(5)
    setMessage('Subiendo archivo...')
    setJobId(null)

    const form = new FormData()
    form.append('audio', file)
    form.append('intervalSecs', String(intervalSecs))
    form.append('volume', String(volume))

    try {
      const res = await fetch('/api/watermark', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.job_id) {
        setStatus('error')
        setMessage(data.error ?? 'Error al iniciar el proceso')
        return
      }

      setJobId(data.job_id)
      setStatus('processing')
      setProgress(15)
      setMessage('Procesando...')

      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/watermark/status/${data.job_id}`)
          const sd = await sr.json()
          setProgress(sd.progress ?? progress)
          setMessage(sd.message ?? '')

          if (sd.status === 'done') {
            stopPolling()
            setStatus('done')
            setProgress(100)
          } else if (sd.status === 'error') {
            stopPolling()
            setStatus('error')
            setMessage(sd.message ?? 'Error en el procesamiento')
          }
        } catch {
          // keep polling
        }
      }, 1200)
    } catch {
      setStatus('error')
      setMessage('Error de conexión')
    }
  }

  function handleDownload() {
    if (!jobId) return
    window.open(`/api/watermark/download/${jobId}`, '_blank')
  }

  function handleReset() {
    stopPolling()
    setFile(null)
    setStatus('idle')
    setProgress(0)
    setMessage('')
    setJobId(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm flex items-center gap-1"
        >
          ← Inicio
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg">🎵</span>
          <span className="text-sm font-semibold text-white">Marca de Agua de Audio</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
            CL
          </div>
          <span className="text-xs text-gray-500">Creaciones Lalis</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-xl flex flex-col gap-5">

          {/* Upload zone */}
          <div
            className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
              dragOver
                ? 'border-indigo-400 bg-indigo-950/30'
                : file
                ? 'border-indigo-600/50 bg-gray-900'
                : 'border-gray-700 bg-gray-900 hover:border-gray-500'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFileChange(e.dataTransfer.files[0] ?? null)
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <span className="text-3xl">🎵</span>
            {file ? (
              <div className="text-center">
                <p className="text-green-400 font-medium text-sm">{file.name}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB — clic para cambiar
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-300 text-sm font-medium">Arrastra tu canción aquí</p>
                <p className="text-gray-600 text-xs mt-1">o haz clic para seleccionar — MP3, WAV, M4A...</p>
              </div>
            )}
          </div>

          {/* Config */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configuración</h3>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Intervalo entre marcas</label>
                <span className="text-xs text-indigo-400 font-medium tabular-nums">{intervalSecs}s</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={intervalSecs}
                onChange={(e) => setIntervalSecs(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>5s</span><span>60s</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Volumen de la marca</label>
                <span className="text-xs text-indigo-400 font-medium tabular-nums">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={2}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>5%</span><span>200%</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          {status !== 'idle' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${status === 'error' ? 'text-red-400' : status === 'done' ? 'text-green-400' : 'text-indigo-400'}`}>
                  {status === 'error' ? 'Error' : status === 'done' ? 'Completado' : 'Procesando...'}
                </span>
                <span className="text-gray-500 tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {message && (
                <p className="text-xs text-gray-500">{message}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status === 'done' ? (
              <>
                <Button variant="primary" onClick={handleDownload} className="flex-1">
                  Descargar audio con marca
                </Button>
                <Button variant="secondary" onClick={handleReset}>
                  Nuevo
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={handleProcess}
                disabled={!file || status === 'uploading' || status === 'processing'}
                className="flex-1"
              >
                {status === 'uploading' || status === 'processing' ? 'Procesando...' : 'Agregar marca de agua'}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
