import { useState } from 'react'

interface Props {
  onValidated: (code: string) => void
}

export function CodeForm({ onValidated }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = code.trim().toUpperCase()
    if (!cleaned) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/ruleta/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      })
      const data = await res.json()

      if (data.valid) {
        onValidated(cleaned)
      } else {
        setError(data.message || 'Código inválido')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-sm">
      <p className="text-gray-400 text-sm text-center">
        Ingresa tu código para girar la ruleta
      </p>
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
          placeholder="Ej: A1B2C3D4"
          maxLength={8}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg font-mono tracking-widest uppercase placeholder:text-gray-600 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-all"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
        >
          {loading ? '...' : 'Validar'}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
    </form>
  )
}
