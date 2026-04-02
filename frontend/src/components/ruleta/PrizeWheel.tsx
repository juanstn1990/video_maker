import { useEffect, useRef, useState } from 'react'

interface Prize {
  id: string
  label: string
}

interface Props {
  prizes: Prize[]
  spinning: boolean
  targetSegment: number | null
  onSpinComplete: () => void
}

const SEGMENT_COLORS = [
  '#FF3366', // hot pink - 10%
  '#FFD700', // gold - 20%
  '#00FF88', // neon green - 30%
  '#00BFFF', // deep sky blue - 40%
  '#FF6B35', // vibrant orange - 50%
  '#B24BF3', // vivid purple - canción
  '#FF1493', // deep pink - video
]

const TEXT_COLORS = [
  '#ffffff',
  '#000000',
  '#000000',
  '#000000',
  '#000000',
  '#ffffff',
  '#ffffff',
]

const GLOW_COLORS = [
  'rgba(255, 51, 102, 0.8)',
  'rgba(255, 215, 0, 0.8)',
  'rgba(0, 255, 136, 0.8)',
  'rgba(0, 191, 255, 0.8)',
  'rgba(255, 107, 53, 0.8)',
  'rgba(178, 75, 243, 0.8)',
  'rgba(255, 20, 147, 0.8)',
]

const CX = 200
const CY = 200
const R = 172
const INNER_R = 28

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as [number, number]
}

function slicePath(startDeg: number, endDeg: number) {
  const [x1, y1] = polarToCartesian(CX, CY, R, startDeg)
  const [x2, y2] = polarToCartesian(CX, CY, R, endDeg)
  const [ix1, iy1] = polarToCartesian(CX, CY, INNER_R, startDeg)
  const [ix2, iy2] = polarToCartesian(CX, CY, INNER_R, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${ix1} ${iy1}`,
    `L ${x1} ${y1}`,
    `A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${ix2} ${iy2}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ')
}

export function PrizeWheel({ prizes, spinning, targetSegment, onSpinComplete }: Props) {
  const n = prizes.length
  const segArc = 360 / n
  const wheelRef = useRef<SVGGElement>(null)
  const [rotation, setRotation] = useState(0)
  const prevSpinning = useRef(false)

  useEffect(() => {
    if (spinning && !prevSpinning.current && targetSegment !== null) {
      const targetMid = targetSegment * segArc + segArc / 2
      const toTop = (360 - targetMid % 360) % 360
      const jitter = (Math.random() - 0.5) * segArc * 0.55
      const newRotation = rotation + 5 * 360 + toTop + jitter
      setRotation(newRotation)
    }
    prevSpinning.current = spinning
  }, [spinning, targetSegment])

  function handleTransitionEnd() {
    if (spinning) {
      onSpinComplete()
    }
  }

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Animated glow rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(79,70,229,0.2) 50%, transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '440px',
            height: '440px',
            background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(168,85,247,0.1) 50%, transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite 1.5s',
          }}
        />
      </div>

      {/* Pointer */}
      <div
        className="absolute top-0 left-1/2 z-10 animate-bounce"
        style={{
          transform: 'translateX(-50%) translateY(-2px)',
          animationDuration: '2s',
        }}
      >
        <svg width="32" height="38" viewBox="0 0 32 38">
          <defs>
            <linearGradient id="pointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <polygon
            points="16,34 2,4 30,4"
            fill="url(#pointerGradient)"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="drop-shadow(0 4px 8px rgba(0,0,0,0.5))"
          />
          <circle cx="16" cy="7" r="4" fill="#ffffff" />
          <circle cx="16" cy="7" r="2" fill="#fbbf24" />
        </svg>
      </div>

      {/* Wheel */}
      <div
        className="rounded-full shadow-2xl shadow-indigo-900/60 relative z-10"
        style={{
          filter: 'drop-shadow(0 0 32px rgba(168,85,247,0.6))',
        }}
      >
        <svg
          width="400"
          height="400"
          viewBox="0 0 400 400"
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          <defs>
            {/* Gradients for each segment */}
            {SEGMENT_COLORS.map((color, i) => (
              <radialGradient key={`grad-${i}`} id={`segGrad${i}`} cx="50%" cy="50%">
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.85" />
              </radialGradient>
            ))}
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Outer ring glow - more vibrant */}
          <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#a855f7" strokeWidth="4" opacity="0.8">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={CX} cy={CY} r={R + 12} fill="none" stroke="#ec4899" strokeWidth="2" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite" />
          </circle>

          {/* Segments group with rotation */}
          <g
            ref={wheelRef}
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {prizes.map((prize, i) => {
              const startDeg = i * segArc
              const endDeg = (i + 1) * segArc
              const midDeg = startDeg + segArc / 2
              const [tx, ty] = polarToCartesian(CX, CY, R * 0.63, midDeg)

              // Split long labels into two lines
              const words = prize.label.split(' ')
              let line1 = prize.label
              let line2 = ''
              if (words.length >= 3 && prize.label.length > 12) {
                const mid = Math.ceil(words.length / 2)
                line1 = words.slice(0, mid).join(' ')
                line2 = words.slice(mid).join(' ')
              }

              return (
                <g key={prize.id}>
                  {/* Segment with gradient */}
                  <path
                    d={slicePath(startDeg, endDeg)}
                    fill={`url(#segGrad${i})`}
                    stroke="#1a0a2e"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  {/* Label */}
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={line2 ? '11' : '12'}
                    fontWeight="700"
                    fill={TEXT_COLORS[i % TEXT_COLORS.length]}
                    transform={`rotate(${midDeg}, ${tx}, ${ty})`}
                    style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.01em' }}
                  >
                    {line2 ? (
                      <>
                        <tspan x={tx} dy="-7">{line1}</tspan>
                        <tspan x={tx} dy="14">{line2}</tspan>
                      </>
                    ) : (
                      prize.label
                    )}
                  </text>
                </g>
              )
            })}

            {/* Segment dividers */}
            {prizes.map((_, i) => {
              const angle = i * segArc
              const [x2, y2] = polarToCartesian(CX, CY, R, angle)
              const [ix2, iy2] = polarToCartesian(CX, CY, INNER_R, angle)
              return (
                <line
                  key={`div-${i}`}
                  x1={ix2} y1={iy2}
                  x2={x2} y2={y2}
                  stroke="#1e1b4b"
                  strokeWidth="2"
                />
              )
            })}
          </g>

          {/* Center cap - enhanced */}
          <circle cx={CX} cy={CY} r={INNER_R + 4} fill="url(#centerGrad)" stroke="#fbbf24" strokeWidth="3" filter="url(#glow)" />
          <circle cx={CX} cy={CY} r={INNER_R - 2} fill="#1e1b4b" />
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="800" fill="#fbbf24" style={{ fontFamily: 'system-ui, sans-serif' }}>★</text>

          {/* Additional gradient for center */}
          <defs>
            <radialGradient id="centerGrad">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#3730a3" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
