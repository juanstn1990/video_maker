import { useEffect, useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import type { VideoConfig } from '../../types/video'

interface ProjectRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface ProjectsModalProps {
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProjectsModal({ onClose }: ProjectsModalProps) {
  const { loadConfig } = useEditorStore()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudo cargar la lista de proyectos')
        setLoading(false)
      })
  }, [])

  async function handleOpen(id: string) {
    setOpening(id)
    try {
      const r = await fetch(`/api/projects/${id}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      loadConfig(data.project.config as VideoConfig, id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al abrir el proyecto')
    } finally {
      setOpening(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este proyecto?')) return
    setDeleting(id)
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Error al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-base">Mis Proyectos</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="text-red-400 text-sm text-center mb-3">{error}</p>
          )}

          {loading ? (
            <div className="text-center text-gray-500 text-sm py-10">Cargando...</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">
              No hay proyectos guardados todavía.
            </div>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 border border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Guardado: {formatDate(p.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpen(p.id)}
                    disabled={opening === p.id}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
                  >
                    {opening === p.id ? '...' : 'Abrir'}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {deleting === p.id ? '...' : 'Eliminar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
