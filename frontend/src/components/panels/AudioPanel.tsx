import { useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Slider } from '../ui/Slider'
import { Button } from '../ui/Button'

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.onloadedmetadata = () => resolve(audio.duration)
    audio.onerror = () => reject(new Error('No se pudo cargar el audio'))
    audio.load()
  })
}

export function AudioPanel() {
  const { config, setAudioTrack, fitClipDurationsToAudio } = useEditorStore()
  const track = config.audioTrack
  const [fitting, setFitting] = useState(false)
  const [fitResult, setFitResult] = useState<string | null>(null)

  if (!track) {
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Audio</h3>
        <p className="text-xs text-gray-500">
          Selecciona un archivo de audio desde el panel de media.
        </p>
      </div>
    )
  }

  async function handleFitToAudio() {
    if (!track) return
    setFitting(true)
    setFitResult(null)
    try {
      const totalDuration = await getAudioDuration(track.mediaUrl)
      // Effective duration: subtract the "start from" offset
      const effectiveDuration = Math.max(0.5, totalDuration - track.startFromSeconds)
      const imageClips = config.clips.filter((c) => c.type === 'image')
      if (imageClips.length === 0) {
        setFitResult('No hay clips de imagen para ajustar.')
        return
      }
      fitClipDurationsToAudio(effectiveDuration)
      const secPerClip = (effectiveDuration / imageClips.length).toFixed(1)
      setFitResult(
        `${imageClips.length} clips → ${secPerClip}s c/u (audio ${effectiveDuration.toFixed(1)}s)`
      )
    } catch {
      setFitResult('Error al leer la duración del audio.')
    } finally {
      setFitting(false)
    }
  }

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Audio</h3>
        <Button variant="danger" size="sm" onClick={() => setAudioTrack(null)}>
          Quitar
        </Button>
      </div>

      <p className="text-xs text-gray-300 truncate" title={track.mediaUrl}>
        {track.mediaId}
      </p>

      {/* Fit to audio */}
      <div className="bg-gray-800 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-400">
          Distribuye la duración del audio equitativamente entre todas las imágenes.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleFitToAudio}
        >
          {fitting ? 'Calculando...' : 'Ajustar clips al audio'}
        </Button>
        {fitResult && (
          <p className="text-[11px] text-green-400">{fitResult}</p>
        )}
      </div>

      <Slider
        label="Volumen"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        displayValue={`${Math.round(track.volume * 100)}%`}
        onChange={(e) => setAudioTrack({ ...track, volume: parseFloat(e.target.value) })}
      />

      <Slider
        label="Fade In (frames)"
        min={0}
        max={120}
        step={1}
        value={track.fadeInFrames}
        displayValue={track.fadeInFrames}
        onChange={(e) => setAudioTrack({ ...track, fadeInFrames: parseInt(e.target.value) })}
      />

      <Slider
        label="Fade Out (frames)"
        min={0}
        max={120}
        step={1}
        value={track.fadeOutFrames}
        displayValue={track.fadeOutFrames}
        onChange={(e) => setAudioTrack({ ...track, fadeOutFrames: parseInt(e.target.value) })}
      />

      <Slider
        label="Iniciar desde (seg)"
        min={0}
        max={300}
        step={0.5}
        value={track.startFromSeconds}
        displayValue={`${track.startFromSeconds}s`}
        onChange={(e) => setAudioTrack({ ...track, startFromSeconds: parseFloat(e.target.value) })}
      />
    </div>
  )
}
