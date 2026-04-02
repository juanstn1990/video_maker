import { useState } from 'react'

interface Props {
  alwaysOpen?: boolean
}

export function AdminPanel({ alwaysOpen = false }: Props) {
  const [open, setOpen] = useState(alwaysOpen)
  const [adminKey, setAdminKey] = useState('')
  const [count, setCount] = useState(10)
  const [generated, setGenerated] = useState<string[]>([])
  const [codesList, setCodesList] = useState<{ code: string; used: boolean; prize?: string; usedAt?: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ruleta/generate-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, adminKey }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setGenerated(data.codes)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  async function handleListCodes() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ruleta/codes?adminKey=${encodeURIComponent(adminKey)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setCodesList(data.codes)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div className="w-full">
      {!alwaysOpen && (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors mx-auto"
        >
          <span>⚙️</span>
          <span>{open ? 'Cerrar panel admin' : 'Panel admin - Generar códigos'}</span>
        </button>
      )}

      {(open || alwaysOpen) && (
        <div className={`${alwaysOpen ? '' : 'mt-3 bg-gray-900 border border-gray-800 rounded-xl p-5'} flex flex-col gap-4`}>
          {!alwaysOpen && <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Administración de Códigos - Ruleta</h3>}

          <div className="flex gap-3">
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Clave admin"
              className={`flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-indigo-500 ${alwaysOpen ? 'py-3 text-base' : 'py-2 text-sm'}`}
            />
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <label className={`${alwaysOpen ? 'text-base' : 'text-sm'} text-gray-400 font-medium`}>Cantidad:</label>
            <input
              type="number"
              value={count}
              min={1}
              max={500}
              onChange={e => setCount(Number(e.target.value))}
              className={`bg-gray-800 border border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-indigo-500 ${alwaysOpen ? 'w-32 py-3 text-base' : 'w-24 py-2 text-sm'}`}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !adminKey}
              className={`rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-all ${alwaysOpen ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}`}
            >
              Generar códigos
            </button>
            <button
              onClick={handleListCodes}
              disabled={loading || !adminKey}
              className={`rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-semibold transition-all ${alwaysOpen ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}`}
            >
              Ver todos los códigos
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {generated.length > 0 && (
            <div>
              <p className={`text-green-400 mb-3 font-semibold ${alwaysOpen ? 'text-lg' : 'text-sm'}`}>✅ {generated.length} código(s) generado(s):</p>
              <div className={`grid gap-3 ${alwaysOpen ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-4'}`}>
                {generated.map(c => (
                  <span key={c} className={`bg-gray-800 border border-gray-700 rounded font-mono text-gray-300 text-center ${alwaysOpen ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'}`}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {codesList.length > 0 && (
            <div className={`overflow-y-auto ${alwaysOpen ? 'max-h-96' : 'max-h-64'}`}>
              <p className={`text-gray-300 mb-3 font-semibold ${alwaysOpen ? 'text-base' : 'text-sm'}`}>📊 Total: {codesList.length} código(s)</p>
              <table className={`w-full ${alwaysOpen ? 'text-base' : 'text-sm'}`}>
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className={`text-left font-semibold ${alwaysOpen ? 'py-3' : 'py-2'}`}>Código</th>
                    <th className={`text-left font-semibold ${alwaysOpen ? 'py-3' : 'py-2'}`}>Estado</th>
                    <th className={`text-left font-semibold ${alwaysOpen ? 'py-3' : 'py-2'}`}>Premio</th>
                    <th className={`text-left font-semibold ${alwaysOpen ? 'py-3' : 'py-2'}`}>Usado</th>
                  </tr>
                </thead>
                <tbody>
                  {codesList.map(c => (
                    <tr key={c.code} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className={`font-mono text-gray-300 ${alwaysOpen ? 'py-3' : 'py-2'}`}>{c.code}</td>
                      <td className={alwaysOpen ? 'py-3' : 'py-2'}>
                        <span className={`px-2 py-1 rounded font-medium ${alwaysOpen ? 'text-sm' : 'text-xs'} ${c.used ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                          {c.used ? 'Usado' : 'Disponible'}
                        </span>
                      </td>
                      <td className={`text-gray-400 ${alwaysOpen ? 'py-3' : 'py-2'}`}>{c.prize || '—'}</td>
                      <td className={`text-gray-500 ${alwaysOpen ? 'py-3 text-sm' : 'py-2 text-xs'}`}>{c.usedAt ? new Date(c.usedAt).toLocaleString('es') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
