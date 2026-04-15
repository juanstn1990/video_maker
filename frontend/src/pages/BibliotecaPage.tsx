import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface WatermarkRecord {
  id: number
  token: string
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [linkOpenId, setLinkOpenId] = useState<number | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
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
    a.href = `/api/biblioteca/download/${record.token}`
    a.download = record.output_filename.replace(/^watermarked_/, '')
    a.click()
    setTimeout(() => setDownloading(null), 2000)
  }

  function handlePlay(record: WatermarkRecord) {
    if (playingId === record.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(`/api/biblioteca/stream/${record.id}`)
    audioRef.current = audio
    audio.addEventListener('ended', () => setPlayingId(null))
    audio.addEventListener('error', () => {
      setPlayingId(null)
      setError('No se pudo reproducir el archivo de audio')
    })
    audio.play().then(() => setPlayingId(record.id)).catch(() => {
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

  function handleLinkToggle(id: number) {
    if (linkOpenId === id) {
      setLinkOpenId(null)
      setLinkCopied(false)
    } else {
      setLinkOpenId(id)
      setLinkCopied(false)
    }
  }

  function handleCopyLink(record: WatermarkRecord) {
    const url = `${window.location.origin}/api/biblioteca/download/${record.token}`
    const msg = `Este es tu enlace de descarga para que puedas tener la canción en tu celular:\n${url}`
    navigator.clipboard.writeText(msg).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    })
  }

  async function handleDeleteOne(id: number) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/biblioteca/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al borrar')
      if (playingId === id) {
        audioRef.current?.pause()
        setPlayingId(null)
      }
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al borrar')
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm flex items-center gap-1 shrink-0"
        >
          ← Inicio
        </button>
        <div className="w-px h-4 bg-gray-700 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">📚</span>
          <span className="text-sm font-semibold text-white truncate">Biblioteca de Canciones</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
            CL
          </div>
          <span className="text-xs text-gray-500 hidden sm:block">Creaciones Lalis</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-6 px-3 sm:px-4">
        <div className="w-full max-w-3xl flex flex-col gap-4">

          {/* Search + Cleanup */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white">Canciones entregadas</h2>
              {/* Cleanup button */}
              {!cleanupConfirm ? (
                <button
                  onClick={() => { setCleanupConfirm(true); setCleanupResult(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/40 transition-colors shrink-0"
                >
                  🗑 Borrar &gt;1 mes
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
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
                placeholder="Buscar por celular o canción..."
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

          {/* Records — card list (mobile-first) */}
          {!loading && records.length > 0 && (
            <div className="flex flex-col gap-2">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-col gap-2 hover:border-gray-700 transition-colors"
                >
                  {/* Top row: phone + date */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">📱</span>
                      <span className="text-sm text-white font-mono truncate">{rec.phone}</span>
                    </div>
                    <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                      {formatDate(rec.created_at)}
                    </span>
                  </div>

                  {/* Song name */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate" title={rec.song_name}>
                      🎵 {rec.song_name}
                    </p>
                    <p className="text-[11px] text-gray-600 truncate mt-0.5" title={rec.output_filename.replace(/^watermarked_/, '')}>
                      {rec.output_filename.replace(/^watermarked_/, '')}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Play */}
                    <button
                      onClick={() => handlePlay(rec)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center sm:flex-none ${
                        playingId === rec.id
                          ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/40'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                      }`}
                    >
                      {playingId === rec.id ? '⏸ Pausar' : '▶ Reproducir'}
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => handleDownload(rec)}
                      disabled={downloading === rec.id}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center sm:flex-none ${
                        downloading === rec.id
                          ? 'bg-green-800/30 text-green-400 cursor-default border border-green-700/30'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/30'
                      }`}
                    >
                      {downloading === rec.id ? '✓ Descargando' : '⬇ Descargar'}
                    </button>

                    {/* Link */}
                    <button
                      onClick={() => handleLinkToggle(rec.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center sm:flex-none ${
                        linkOpenId === rec.id
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-600/40'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                      }`}
                    >
                      🔗 Enlace
                    </button>


                    {/* Delete */}
                    {deleteConfirmId === rec.id ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">¿Borrar?</span>
                        <button
                          onClick={() => handleDeleteOne(rec.id)}
                          disabled={deletingId === rec.id}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                        >
                          {deletingId === rec.id ? 'Borrando...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(rec.id)}
                        title="Borrar registro"
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/30 transition-colors ml-auto"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  {/* Link panel */}
                  {linkOpenId === rec.id && (
                    <div className="w-full mt-1 bg-amber-950/30 border border-amber-700/40 rounded-xl p-3 flex flex-col gap-2">
                      <pre className="text-xs text-amber-100 whitespace-pre-wrap break-all leading-relaxed font-sans select-all cursor-text">
                        {`Este es tu enlace de descarga para que puedas tener la canción en tu celular:\n${window.location.origin}/api/biblioteca/download/${rec.token}`}
                      </pre>
                      <button
                        onClick={() => handleCopyLink(rec)}
                        className="self-end flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700/40 hover:bg-amber-700/60 text-amber-200 border border-amber-600/40 transition-colors"
                      >
                        {linkCopied ? '✓ Copiado' : '📋 Copiar mensaje'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
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
