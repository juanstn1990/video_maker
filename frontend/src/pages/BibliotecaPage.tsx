import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface WatermarkRecord {
  id: number
  job_id: string
  phone: string
  song_name: string
  output_filename: string
  input_path: string | null
  created_at: string
}

export function BibliotecaPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<WatermarkRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<number | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [cleanupConfirm, setCleanupConfirm] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  async function fetchRecords(q: string) {
    setLoading(true)
    setError('')
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      const res = await fetch(`/api/biblioteca/search${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al buscar')
      setRecords(data.records ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // Load all on mount
  useEffect(() => {
    fetchRecords('')
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  function handleSearch(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRecords(val), 400)
  }

  function handleDownload(record: WatermarkRecord) {
    setDownloading(record.id)
    const a = document.createElement('a')
    a.href = `/api/biblioteca/download/${record.id}`
    a.download = record.output_filename.replace(/^watermarked_/, '')
    a.click()
    setTimeout(() => setDownloading(null), 2000)
  }

  function handlePlay(record: WatermarkRecord) {
    // If same record is playing, pause it
    if (playingId === record.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    // Stop any currently playing audio
    audioRef.current?.pause()

    const audio = new Audio(`/api/biblioteca/stream/${record.id}`)
    audioRef.current = audio

    audio.addEventListener('ended', () => setPlayingId(null))
    audio.addEventListener('error', () => {
      setPlayingId(null)
      setError('No se pudo reproducir el archivo de audio')
    })

    audio.play().then(() => {
      setPlayingId(record.id)
    }).catch(() => {
      setPlayingId(null)
      setError('No se pudo reproducir el archivo de audio')
    })
  }

  async function handleCleanup() {
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const res = await fetch('/api/biblioteca/cleanup', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al limpiar')
      const msg = data.deleted === 0
        ? 'No había registros con más de 1 mes'
        : `Se eliminaron ${data.deleted} registro${data.deleted !== 1 ? 's' : ''} (+ sus archivos)`
      setCleanupResult(msg)
      fetchRecords(query)
    } catch (e: unknown) {
      setCleanupResult(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setCleanupLoading(false)
      setCleanupConfirm(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm flex items-center gap-1"
        >
          ← Inicio
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span>
          <span className="text-sm font-semibold text-white">Biblioteca de Canciones</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
            CL
          </div>
          <span className="text-xs text-gray-500">Creaciones Lalis</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-3xl flex flex-col gap-5">

          {/* Search + Cleanup */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Buscar canciones entregadas</h2>
              {/* Cleanup button */}
              {!cleanupConfirm ? (
                <button
                  onClick={() => { setCleanupConfirm(true); setCleanupResult(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/40 transition-colors"
                >
                  🗑 Borrar &gt;1 mes
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">¿Seguro?</span>
                  <button
                    onClick={handleCleanup}
                    disabled={cleanupLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                  >
                    {cleanupLoading ? 'Borrando...' : 'Sí, borrar'}
                  </button>
                  <button
                    onClick={() => setCleanupConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Buscar por celular o nombre de canción..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {cleanupResult && (
              <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                ✓ {cleanupResult}
              </p>
            )}

            {!loading && !error && (
              <p className="text-xs text-gray-600">
                {records.length === 0
                  ? 'Sin resultados'
                  : `${records.length} registro${records.length !== 1 ? 's' : ''} encontrado${records.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Buscando...</span>
              </div>
            </div>
          )}

          {/* Records table */}
          {!loading && records.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1.5fr_1fr_auto] gap-3 px-4 py-2.5 bg-gray-800/60 border-b border-gray-800">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Celular</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Canción</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fecha y hora</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Acciones</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-800/50">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="grid grid-cols-[1fr_1.5fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Phone */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">📱</span>
                      <span className="text-sm text-white font-mono truncate">{rec.phone}</span>
                    </div>

                    {/* Song name */}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate" title={rec.song_name}>
                        {rec.song_name}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate" title={rec.output_filename.replace(/^watermarked_/, '')}>
                        {rec.output_filename.replace(/^watermarked_/, '')}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 tabular-nums">{formatDate(rec.created_at)}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Play button */}
                      <button
                        onClick={() => handlePlay(rec)}
                        title={playingId === rec.id ? 'Pausar' : 'Reproducir'}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all ${
                          playingId === rec.id
                            ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/40'
                            : 'bg-gray-700/40 hover:bg-gray-700/70 text-gray-400 hover:text-white border border-gray-700/40'
                        }`}
                      >
                        {playingId === rec.id ? '⏸' : '▶'}
                      </button>

                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(rec)}
                        disabled={downloading === rec.id}
                        title="Descargar (sin marca de agua)"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          downloading === rec.id
                            ? 'bg-green-800/30 text-green-400 cursor-default'
                            : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/30'
                        }`}
                      >
                        {downloading === rec.id ? '✓ Descargando' : '⬇ Descargar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && records.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-4xl">🎵</span>
              <p className="text-gray-500 text-sm text-center">
                {query
                  ? `No se encontraron canciones para "${query}"`
                  : 'Aún no hay canciones registradas'}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
