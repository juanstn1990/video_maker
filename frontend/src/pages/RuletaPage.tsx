import { useState } from 'react'
import { PrizeWheel } from '../components/ruleta/PrizeWheel'
import { CodeForm } from '../components/ruleta/CodeForm'
import { PrizeResult } from '../components/ruleta/PrizeResult'

type SpinState = 'enter-code' | 'ready' | 'spinning' | 'done'

interface Prize {
  id: string
  label: string
}

const PRIZES = [
  { id: 'discount10', label: '10% descuento' },
  { id: 'discount20', label: '20% descuento' },
  { id: 'discount30', label: '30% descuento' },
  { id: 'discount40', label: '40% descuento' },
  { id: 'discount50', label: '50% descuento' },
  { id: 'freeSong',   label: '🎵 Canción gratis' },
  { id: 'freeVideo',  label: '🎬 Video gratis' },
]

export function RuletaPage() {
  const [spinState, setSpinState] = useState<SpinState>('enter-code')
  const [code, setCode] = useState('')
  const [targetSegment, setTargetSegment] = useState<number | null>(null)
  const [wonPrize, setWonPrize] = useState<Prize | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [spinError, setSpinError] = useState('')
  const [spinning, setSpinning] = useState(false)

  function handleCodeValidated(validCode: string) {
    setCode(validCode)
    setSpinState('ready')
  }

  async function handleSpin() {
    setSpinError('')
    setSpinState('spinning')

    try {
      const res = await fetch('/api/ruleta/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSpinState('ready')
        setSpinError(data.error || 'Error al girar')
        alert(`❌ Error: ${data.error || 'Error al girar'}`)
        return
      }

      // Set target first, then start spinning animation
      setTargetSegment(data.segmentIndex)
      setWonPrize(data.prize)
      setSpinning(true)
    } catch (err) {
      setSpinState('ready')
      const errorMsg = 'Error de conexión con el servidor'
      setSpinError(errorMsg)
      alert(`❌ ${errorMsg}`)
      console.error('Spin error:', err)
    }
  }

  function handleSpinComplete() {
    setSpinning(false)
    setSpinState('done')
    setTimeout(() => setShowResult(true), 500)
  }

  function handleResultClose() {
    setShowResult(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950" style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0a0a0f 70%)' }}>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 gap-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            🎡 Ruleta de Premios
          </h1>
          <p className="text-xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-1">
            lalala music
          </p>
          <p className="text-gray-400 text-sm mb-3">¡Gira y gana descuentos exclusivos!</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg">
            <span className="text-amber-400 text-lg">⚠️</span>
            <p className="text-amber-200 text-sm font-medium">
              Descuento válido únicamente para hoy: <span className="font-bold">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
          </div>
        </div>

        {/* Wheel */}
        <PrizeWheel
          prizes={PRIZES}
          spinning={spinning}
          targetSegment={targetSegment}
          onSpinComplete={handleSpinComplete}
        />

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {spinState === 'enter-code' && (
            <CodeForm onValidated={handleCodeValidated} />
          )}

          {spinState === 'ready' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-950/40 border border-green-800/50 rounded-xl">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-green-300 text-sm font-medium">Código válido:</span>
                <span className="text-green-400 font-mono font-bold tracking-widest text-sm">{code}</span>
              </div>
              {spinError && <p className="text-red-400 text-sm text-center">{spinError}</p>}
              <button
                onClick={handleSpin}
                className="w-full py-4 rounded-2xl text-white font-black text-xl tracking-wide transition-all"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  boxShadow: '0 0 30px rgba(99,102,241,0.5)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(99,102,241,0.5)')}
              >
                ¡GIRAR! 🎰
              </button>
            </>
          )}

          {spinState === 'spinning' && (
            <p className="text-indigo-300 text-sm animate-pulse font-medium">Girando...</p>
          )}

          {spinState === 'done' && !showResult && wonPrize && (
            <button
              onClick={() => setShowResult(true)}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
            >
              Ver mi premio 🎁
            </button>
          )}
        </div>
      </div>

      {/* Prize result overlay */}
      {showResult && wonPrize && (
        <PrizeResult prize={wonPrize} onClose={handleResultClose} />
      )}
    </div>
  )
}
