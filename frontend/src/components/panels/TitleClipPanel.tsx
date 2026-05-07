import { useEditorStore } from '../../store/useEditorStore'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'
import { ColorInput } from '../ui/ColorInput'
import { FontPicker } from '../ui/FontPicker'
import type { TitleClipConfig, TextAnimation } from '../../types/video'

const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'slideUp', label: 'Deslizar Arriba' },
  { value: 'slideDown', label: 'Deslizar Abajo' },
  { value: 'slideLeft', label: 'Deslizar Izquierda' },
  { value: 'slideRight', label: 'Deslizar Derecha' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'bounce', label: 'Bounce (rebote)' },
  { value: 'pop', label: 'Pop (elástico)' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'typewriter', label: 'Máquina de Escribir' },
]

const TRANSITIONS = [
  { value: 'none', label: 'Sin transición' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade', label: 'Fade' },
  { value: 'slideLeft', label: 'Slide Izquierda' },
  { value: 'slideRight', label: 'Slide Derecha' },
  { value: 'zoomIn', label: 'Zoom In' },
]

interface Props { clip: TitleClipConfig }

export function TitleClipPanel({ clip }: Props) {
  const { updateTitleClip, updateTransition, moveTitleClip, config } = useEditorStore()
  const fps = config.fps
  const durationSec = clip.durationFrames / fps
  const clipIndex = config.clips.findIndex((c) => c.id === clip.id)
  const position = clipIndex === 0 ? 'start' : clipIndex === config.clips.length - 1 ? 'end' : 'middle'

  return (
    <div className="space-y-4 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clip de Título</h3>

      <Input
        label="Texto principal"
        value={clip.text}
        onChange={(e) => updateTitleClip(clip.id, { text: e.target.value })}
      />

      <Input
        label="Subtexto (opcional)"
        value={clip.subtext ?? ''}
        onChange={(e) => updateTitleClip(clip.id, { subtext: e.target.value || undefined })}
      />

      <Slider
        label="Duración"
        min={fps * 0.5}
        max={fps * 30}
        step={fps}
        value={clip.durationFrames}
        displayValue={`${Math.round(durationSec * 10) / 10}s`}
        onChange={(e) => updateTitleClip(clip.id, { durationFrames: parseInt(e.target.value) })}
      />

      <FontPicker
        label="Fuente"
        value={clip.fontFamily}
        onChange={(fontFamily) => updateTitleClip(clip.id, { fontFamily })}
      />

      <Slider
        label="Tamaño de fuente"
        min={20}
        max={200}
        step={2}
        value={clip.fontSize}
        displayValue={clip.fontSize}
        onChange={(e) => updateTitleClip(clip.id, { fontSize: parseInt(e.target.value) })}
      />

      <ColorInput
        label="Color del texto"
        value={clip.color}
        onChange={(v) => updateTitleClip(clip.id, { color: v })}
      />

      <ColorInput
        label="Color de fondo"
        value={clip.backgroundColor}
        onChange={(v) => updateTitleClip(clip.id, { backgroundColor: v })}
      />

      <Select
        label="Animación entrada"
        value={clip.animationIn}
        options={ANIMATIONS}
        onChange={(e) => updateTitleClip(clip.id, { animationIn: e.target.value as TextAnimation })}
      />

      <Select
        label="Animación salida"
        value={clip.animationOut}
        options={ANIMATIONS}
        onChange={(e) => updateTitleClip(clip.id, { animationOut: e.target.value as TextAnimation })}
      />

      <div className="border-t border-gray-800 pt-3 space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Posición en video</h4>
        <div className="flex gap-2">
          {(['start', 'end'] as const).map((pos) => (
            <button
              key={pos}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                position === pos
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => moveTitleClip(clip.id, pos)}
            >
              {pos === 'start' ? 'Inicio' : 'Fin'}
            </button>
          ))}
        </div>
        {position === 'middle' && (
          <p className="text-[10px] text-gray-500">Este clip está en medio del timeline</p>
        )}
      </div>

      <div className="border-t border-gray-800 pt-3 space-y-3">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Transición</h4>
        <Select
          label="Tipo"
          value={clip.transitionIn.type}
          options={TRANSITIONS}
          onChange={(e) => updateTransition(clip.id, { type: e.target.value as any })}
        />
        <Slider
          label="Duración (frames)"
          min={0}
          max={60}
          step={1}
          value={clip.transitionIn.durationFrames}
          displayValue={clip.transitionIn.durationFrames}
          onChange={(e) => updateTransition(clip.id, { durationFrames: parseInt(e.target.value) })}
        />
      </div>
    </div>
  )
}
