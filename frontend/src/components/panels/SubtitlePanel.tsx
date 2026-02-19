import { useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Button } from '../ui/Button'
import { Slider } from '../ui/Slider'
import { Select } from '../ui/Select'
import { ColorInput } from '../ui/ColorInput'
import { v4 as uuidv4 } from 'uuid'
import { FONT_OPTIONS } from '../../constants/fonts'
import type { SubtitleConfig, Subtitle, SubtitleAnimation } from '../../types/video'

const ANIMATION_OPTIONS: { value: SubtitleAnimation; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'slideUp', label: 'Deslizar Arriba' },
  { value: 'bounce', label: 'Bounce (rebote)' },
  { value: 'pop', label: 'Pop (elástico)' },
]

const POSITION_OPTIONS = [
  { value: 'top', label: 'Arriba' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Abajo' },
]

const SUBTITLE_STYLE_OPTIONS = [
  { value: 'normal', label: 'Normal (predeterminado)' },
  { value: 'karaoke', label: 'Karaoke (resaltado por palabra)' },
]

const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  enabled: true,
  subtitles: [],
  fontFamily: 'sans-serif',
  fontSize: 56,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 3,
  position: 'bottom',
  animationIn: 'fadeIn',
  backgroundBox: true,
  backgroundBoxColor: '#000000',
  backgroundBoxOpacity: 60,
  karaokeStyle: false,
  karaokeHighlightColor: '#FFD700',
}

export function SubtitlePanel() {
  const { config, setSubtitleConfig } = useEditorStore()
  const sub = config.subtitleConfig
  const track = config.audioTrack

  const [transcribing, setTranscribing] = useState(false)
  const [transcribeStep, setTranscribeStep] = useState<'whisper' | 'gpt' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState('')
  const [showLyrics, setShowLyrics] = useState(false)
  const [lastCorrected, setLastCorrected] = useState<boolean | null>(null)

  function enable() {
    setSubtitleConfig({ ...DEFAULT_SUBTITLE_CONFIG, subtitles: sub?.subtitles ?? [] })
  }

  function disable() {
    setSubtitleConfig(null)
  }

  async function handleTranscribe() {
    if (!track) return
    setTranscribing(true)
    setError(null)
    setLastCorrected(null)
    setTranscribeStep('whisper')
    try {
      const hasLyrics = lyrics.trim().length > 10
      if (hasLyrics) setTranscribeStep('whisper')

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: track.mediaId, lyrics: hasLyrics ? lyrics : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al transcribir')

      setLastCorrected(data.corrected ?? false)
      const subtitles: Subtitle[] = data.subtitles
      setSubtitleConfig({
        ...(sub ?? DEFAULT_SUBTITLE_CONFIG),
        enabled: true,
        subtitles,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTranscribing(false)
      setTranscribeStep(null)
    }
  }

  function transcribeButtonLabel() {
    if (!transcribing) return '✦ Generar subtítulos automáticos'
    if (transcribeStep === 'whisper') return lyrics.trim().length > 10 ? 'Transcribiendo (1/2)...' : 'Transcribiendo...'
    return 'Corrigiendo con letra (2/2)...'
  }

  function updateConfig(updates: Partial<SubtitleConfig>) {
    if (!sub) return
    setSubtitleConfig({ ...sub, ...updates })
  }

  function updateSubtitle(id: string, updates: Partial<Subtitle>) {
    if (!sub) return
    setSubtitleConfig({
      ...sub,
      subtitles: sub.subtitles.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })
  }

  function removeSubtitle(id: string) {
    if (!sub) return
    setSubtitleConfig({ ...sub, subtitles: sub.subtitles.filter((s) => s.id !== id) })
  }

  function addSubtitle() {
    if (!sub) return
    const last = sub.subtitles[sub.subtitles.length - 1]
    const start = last ? last.endSeconds + 0.1 : 0
    setSubtitleConfig({
      ...sub,
      subtitles: [
        ...sub.subtitles,
        { id: uuidv4(), text: 'Texto', startSeconds: start, endSeconds: start + 2 },
      ],
    })
  }

  if (!sub) {
    return (
      <div className="p-3 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtítulos</h3>
        <p className="text-xs text-gray-500">Los subtítulos están desactivados.</p>
        <Button variant="primary" size="sm" className="w-full" onClick={enable}>
          Activar subtítulos
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtítulos</h3>
        <Button variant="danger" size="sm" onClick={disable}>
          Desactivar
        </Button>
      </div>

      {/* Transcribe from audio */}
      <div className="bg-gray-800 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-400 font-medium">Transcribir audio con IA</p>
        {!track ? (
          <p className="text-[11px] text-gray-500">Selecciona un audio primero en el panel de Media.</p>
        ) : (
          <>
            <p className="text-[11px] text-gray-500 truncate">Audio: {track.mediaId}</p>

            {/* Optional lyrics for correction */}
            <button
              className="text-[10px] text-indigo-400 hover:text-indigo-200 transition-colors"
              onClick={() => setShowLyrics((v) => !v)}
            >
              {showLyrics ? '▾' : '▸'} {showLyrics ? 'Ocultar letra' : '+ Pegar letra de la canción (opcional)'}
            </button>
            {showLyrics && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500">
                  Si pegas la letra, GPT-4o corregirá los errores de Whisper usando el texto original.
                </p>
                <textarea
                  className="w-full bg-gray-700 text-gray-100 rounded px-2 py-1.5 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  rows={6}
                  placeholder="Pega aquí la letra de la canción..."
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                />
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={handleTranscribe}
            >
              {transcribeButtonLabel()}
            </Button>
          </>
        )}
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        {lastCorrected === true && (
          <p className="text-[11px] text-green-400">✓ Subtítulos corregidos con la letra original</p>
        )}
        {lastCorrected === false && sub && sub.subtitles.length > 0 && (
          <p className="text-[11px] text-gray-500">Transcripción de Whisper (sin corrección)</p>
        )}
      </div>

      {/* Style settings */}
      <div className="border-t border-gray-800 pt-3 space-y-3">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Estilo</h4>

        {/* Subtitle style: Normal vs Karaoke */}
        <Select
          label="Estilo de subtítulo"
          value={sub.karaokeStyle ? 'karaoke' : 'normal'}
          options={SUBTITLE_STYLE_OPTIONS}
          onChange={(e) => updateConfig({ karaokeStyle: e.target.value === 'karaoke' })}
        />

        {sub.karaokeStyle && (
          <div className="bg-gray-800 rounded-lg p-2 space-y-2">
            <p className="text-[11px] text-gray-400">
              Karaoke: cada palabra se resalta al ser "cantada". Requiere transcripción
              sin corrección de letra para tener timestamps por palabra.
            </p>
            <ColorInput
              label="Color de resaltado"
              value={sub.karaokeHighlightColor ?? '#FFD700'}
              onChange={(v) => updateConfig({ karaokeHighlightColor: v })}
            />
          </div>
        )}

        <Select
          label="Posición"
          value={sub.position}
          options={POSITION_OPTIONS}
          onChange={(e) => updateConfig({ position: e.target.value as SubtitleConfig['position'] })}
        />

        {!sub.karaokeStyle && (
          <Select
            label="Animación entrada"
            value={sub.animationIn ?? 'fadeIn'}
            options={ANIMATION_OPTIONS}
            onChange={(e) => updateConfig({ animationIn: e.target.value as SubtitleAnimation })}
          />
        )}

        <Select
          label="Fuente"
          value={sub.fontFamily}
          options={FONT_OPTIONS}
          onChange={(e) => updateConfig({ fontFamily: e.target.value })}
        />

        <Slider
          label="Tamaño de fuente"
          min={24} max={120} step={4}
          value={sub.fontSize} displayValue={`${sub.fontSize}px`}
          onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
        />

        <div className="grid grid-cols-2 gap-2">
          <ColorInput
            label={sub.karaokeStyle ? 'Color base' : 'Color texto'}
            value={sub.color}
            onChange={(v) => updateConfig({ color: v })}
          />
          <ColorInput
            label="Color borde"
            value={sub.strokeColor}
            onChange={(v) => updateConfig({ strokeColor: v })}
          />
        </div>

        <Slider
          label="Grosor borde"
          min={0} max={10} step={1}
          value={sub.strokeWidth} displayValue={sub.strokeWidth}
          onChange={(e) => updateConfig({ strokeWidth: parseInt(e.target.value) })}
        />

        {/* Background box */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sub.backgroundBox}
              onChange={(e) => updateConfig({ backgroundBox: e.target.checked })}
              className="accent-indigo-500"
            />
            Fondo oscuro
          </label>

          {sub.backgroundBox && (
            <div className="pl-4 space-y-2">
              <ColorInput
                label="Color del fondo"
                value={sub.backgroundBoxColor ?? '#000000'}
                onChange={(v) => updateConfig({ backgroundBoxColor: v })}
              />
              <Slider
                label="Opacidad del fondo"
                min={10} max={100} step={5}
                value={sub.backgroundBoxOpacity ?? 60}
                displayValue={`${sub.backgroundBoxOpacity ?? 60}%`}
                onChange={(e) => updateConfig({ backgroundBoxOpacity: parseInt(e.target.value) })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Subtitle list */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider">
            Segmentos ({sub.subtitles.length})
          </h4>
          <Button variant="ghost" size="sm" onClick={addSubtitle}>
            + Agregar
          </Button>
        </div>

        {sub.subtitles.length === 0 ? (
          <p className="text-xs text-gray-600">
            Sin subtítulos. Transcribe el audio o agrega uno manualmente.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {sub.subtitles.map((s) => (
              <div key={s.id} className="bg-gray-800 rounded text-xs">
                {editingId === s.id ? (
                  <div className="p-2 space-y-1.5">
                    <textarea
                      className="w-full bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      rows={2}
                      value={s.text}
                      onChange={(e) => updateSubtitle(s.id, { text: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <label className="flex-1 text-[10px] text-gray-500">
                        Inicio (s)
                        <input
                          type="number"
                          step="0.1"
                          value={s.startSeconds}
                          onChange={(e) => updateSubtitle(s.id, { startSeconds: parseFloat(e.target.value) })}
                          className="w-full mt-0.5 bg-gray-700 text-gray-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </label>
                      <label className="flex-1 text-[10px] text-gray-500">
                        Fin (s)
                        <input
                          type="number"
                          step="0.1"
                          value={s.endSeconds}
                          onChange={(e) => updateSubtitle(s.id, { endSeconds: parseFloat(e.target.value) })}
                          className="w-full mt-0.5 bg-gray-700 text-gray-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </label>
                    </div>
                    <button
                      className="text-indigo-400 text-[10px] hover:text-indigo-200"
                      onClick={() => setEditingId(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 px-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 truncate">{s.text}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {s.startSeconds.toFixed(1)}s → {s.endSeconds.toFixed(1)}s
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        className="text-gray-500 hover:text-indigo-400 transition-colors"
                        onClick={() => setEditingId(s.id)}
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        onClick={() => removeSubtitle(s.id)}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
