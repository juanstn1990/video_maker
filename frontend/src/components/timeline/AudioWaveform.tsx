import { useAudioWaveform } from '../../hooks/useAudioWaveform'

interface Props {
  audioUrl: string
}

export function AudioWaveform({ audioUrl }: Props) {
  const { waveform, loading } = useAudioWaveform(audioUrl)

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex gap-0.5 items-end h-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="w-0.5 bg-green-500 rounded-full opacity-60 animate-pulse"
              style={{
                height: `${30 + Math.sin(i * 0.8) * 20}%`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!waveform) return null

  const n = waveform.length
  const max = Math.max(...Array.from(waveform), 0.001)

  return (
    <svg
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
      className="w-full h-full"
      style={{ display: 'block' }}
    >
      {/* Background gradient bars */}
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#22c55e" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#166534" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {Array.from(waveform).map((v, i) => {
        const normalized = v / max
        const barHeight = Math.max(normalized * 90, 2)
        const y = (100 - barHeight) / 2
        return (
          <rect
            key={i}
            x={i + 0.1}
            y={y}
            width={0.7}
            height={barHeight}
            fill="url(#waveGrad)"
            rx={0.2}
          />
        )
      })}
      {/* Centerline */}
      <line
        x1={0}
        y1={50}
        x2={n}
        y2={50}
        stroke="#166534"
        strokeWidth={0.3}
        strokeOpacity={0.4}
      />
    </svg>
  )
}
