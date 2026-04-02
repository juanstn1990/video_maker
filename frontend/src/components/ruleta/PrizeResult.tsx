import { useEffect, useState } from 'react'

interface Props {
  prize: { id: string; label: string }
  onClose: () => void
}

const CONFETTI_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF9F1C', '#C77DFF', '#FF6BD6', '#ffffff',
]

interface Particle {
  id: number
  x: number
  color: string
  size: number
  duration: number
  delay: number
  rotate: number
}

export function PrizeResult({ prize, onClose }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const ps: Particle[] = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      duration: 1.8 + Math.random() * 1.4,
      delay: Math.random() * 0.6,
      rotate: Math.random() * 720,
    }))
    setParticles(ps)
    // Fade in
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const isSpecial = prize.id === 'freeSong' || prize.id === 'freeVideo'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
      onClick={onClose}
    >
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: '-10px',
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animation: `confettiFall ${p.duration}s ease-in ${p.delay}s both`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative z-10 bg-gray-900 border border-gray-700 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        style={{
          boxShadow: '0 0 60px rgba(99,102,241,0.4)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Stars */}
        <div className="flex justify-center gap-1 mb-4">
          {['✨', '🌟', '✨'].map((s, i) => (
            <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{s}</span>
          ))}
        </div>

        <h2 className="text-white font-bold text-xl mb-2">¡Felicidades!</h2>
        <p className="text-gray-400 text-sm mb-6">Ganaste:</p>

        <div
          className="py-5 px-6 rounded-2xl mb-6"
          style={{
            background: isSpecial
              ? 'linear-gradient(135deg, #312e81, #4c1d95)'
              : 'linear-gradient(135deg, #1e3a5f, #1e4d5f)',
            border: `2px solid ${isSpecial ? '#818cf8' : '#38bdf8'}`,
          }}
        >
          <p
            className="font-black text-3xl tracking-tight"
            style={{ color: isSpecial ? '#c7d2fe' : '#7dd3fc' }}
          >
            {prize.label}
          </p>
        </div>

        <p className="text-gray-500 text-xs mb-4">
          Muestra esta pantalla para reclamar tu premio en lalala music
        </p>

        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-amber-300 text-xs font-semibold">
            ⏰ Válido únicamente para hoy
          </p>
          <p className="text-amber-400/80 text-xs mt-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
        >
          Cerrar
        </button>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(var(--rotate, 720deg)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
