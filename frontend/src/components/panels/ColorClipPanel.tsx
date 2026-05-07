import { useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Slider } from '../ui/Slider'
import { Select } from '../ui/Select'
import { ColorInput } from '../ui/ColorInput'
import { Button } from '../ui/Button'
import { FontPicker } from '../ui/FontPicker'
import type { ColorClipConfig, TextAnimation } from '../../types/video'

const TRANSITIONS = [
  { value: 'none', label: 'Sin transición' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade', label: 'Fade' },
  { value: 'slideLeft', label: 'Slide Izquierda' },
  { value: 'slideRight', label: 'Slide Derecha' },
  { value: 'slideUp', label: 'Slide Arriba' },
  { value: 'slideDown', label: 'Slide Abajo' },
  { value: 'zoomIn', label: 'Zoom In' },
  { value: 'zoomOut', label: 'Zoom Out' },
  { value: 'wipeLeft', label: 'Wipe Izquierda' },
  { value: 'wipeRight', label: 'Wipe Derecha' },
]

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
  { value: 'typewriter', label: 'Máquina de escribir' },
]

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Izq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Der.' },
]

const COLOR_PRESETS = [
  '#000000', '#ffffff', '#1e1e2e', '#0f172a', '#1a1a2e',
  '#e63946', '#2a9d8f', '#e9c46a', '#264653', '#f4a261',
  '#6c5ce7', '#fd79a8', '#00b894', '#0984e3', '#fdcb6e',
]

interface Props { clip: ColorClipConfig }

export function ColorClipPanel({ clip }: Props) {
  const {
    updateColorClip, updateTransition, config,
    addTextOverlay, removeTextOverlay, updateTextOverlay,
  } = useEditorStore()
  const fps = config.fps
  const durationSec = clip.durationFrames / fps
  const [expandedOverlay, setExpandedOverlay] = useState<string | null>(null)

  return (
    <div className="space-y-4 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fondo de Color</h3>

      {/* Duration */}
      <Slider
        label="Duración"
        min={fps * 0.5}
        max={fps * 30}
        step={fps * 0.5}
        value={clip.durationFrames}
        displayValue={`${Math.round(durationSec * 10) / 10}s`}
        onChange={(e) => updateColorClip(clip.id, { durationFrames: parseInt(e.target.value) })}
      />

      {/* Background color */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Color de fondo</h4>

        <ColorInput
          label="Color"
          value={clip.backgroundColor}
          onChange={(v) => updateColorClip(clip.id, { backgroundColor: v })}
        />

        {/* Color presets */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                title={color}
                className={`w-6 h-6 rounded border transition-all ${
                  clip.backgroundColor === color
                    ? 'border-white scale-110'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => updateColorClip(clip.id, { backgroundColor: color })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Transition */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Transición</h4>
        <Select
          label="Tipo"
          value={clip.transitionIn.type}
          options={TRANSITIONS}
          onChange={(e) => updateTransition(clip.id, { type: e.target.value as any })}
        />
        <Slider
          label="Duración (frames)"
          min={0} max={60} step={1}
          value={clip.transitionIn.durationFrames}
          displayValue={clip.transitionIn.durationFrames}
          onChange={(e) => updateTransition(clip.id, { durationFrames: parseInt(e.target.value) })}
        />
      </div>

      {/* Text overlays */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider">Textos</h4>
          <Button variant="ghost" size="sm" onClick={() => addTextOverlay(clip.id)}>
            + Agregar
          </Button>
        </div>

        {clip.textOverlays.length === 0 ? (
          <p className="text-xs text-gray-600">Sin textos</p>
        ) : (
          <div className="space-y-1">
            {clip.textOverlays.map((ov) => {
              const isOpen = expandedOverlay === ov.id
              return (
                <div key={ov.id} className="bg-gray-800 rounded overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <button
                      className="flex-1 text-left text-xs text-gray-300 truncate hover:text-white transition-colors"
                      onClick={() => setExpandedOverlay(isOpen ? null : ov.id)}
                    >
                      {isOpen ? '▾' : '▸'} {ov.text || '(vacío)'}
                    </button>
                    <button
                      className="text-gray-500 hover:text-red-400 text-xs flex-shrink-0"
                      onClick={() => removeTextOverlay(clip.id, ov.id)}
                    >
                      ✕
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-2 pb-3 space-y-2 border-t border-gray-700 pt-2">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Texto</label>
                        <textarea
                          className="w-full bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          rows={2}
                          value={ov.text}
                          onChange={(e) => updateTextOverlay(clip.id, ov.id, { text: e.target.value })}
                        />
                      </div>

                      <FontPicker
                        label="Fuente"
                        value={ov.fontFamily}
                        onChange={(fontFamily) => updateTextOverlay(clip.id, ov.id, { fontFamily })}
                      />

                      <Slider
                        label="Tamaño"
                        min={16} max={200} step={2}
                        value={ov.fontSize} displayValue={`${ov.fontSize}px`}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { fontSize: parseInt(e.target.value) })}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <ColorInput
                          label="Color texto"
                          value={ov.color}
                          onChange={(v) => updateTextOverlay(clip.id, ov.id, { color: v })}
                        />
                        <ColorInput
                          label="Color borde"
                          value={ov.strokeColor}
                          onChange={(v) => updateTextOverlay(clip.id, ov.id, { strokeColor: v })}
                        />
                      </div>

                      <Slider
                        label="Grosor borde"
                        min={0} max={12} step={1}
                        value={ov.strokeWidth} displayValue={ov.strokeWidth}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { strokeWidth: parseInt(e.target.value) })}
                      />

                      <ColorInput
                        label="Fondo"
                        value={ov.backgroundColor === 'transparent' ? '#000000' : ov.backgroundColor}
                        onChange={(v) => updateTextOverlay(clip.id, ov.id, { backgroundColor: v })}
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer -mt-1">
                        <input
                          type="checkbox"
                          checked={ov.backgroundColor === 'transparent'}
                          onChange={(e) => updateTextOverlay(clip.id, ov.id, {
                            backgroundColor: e.target.checked ? 'transparent' : '#000000',
                          })}
                          className="accent-indigo-500"
                        />
                        Sin fondo
                      </label>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ov.bold}
                            onChange={(e) => updateTextOverlay(clip.id, ov.id, { bold: e.target.checked })}
                            className="accent-indigo-500"
                          />
                          Negrita
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ov.italic}
                            onChange={(e) => updateTextOverlay(clip.id, ov.id, { italic: e.target.checked })}
                            className="accent-indigo-500"
                          />
                          Cursiva
                        </label>
                        <div className="ml-auto flex gap-1">
                          {ALIGN_OPTIONS.map((a) => (
                            <button
                              key={a.value}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                ov.align === a.value
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                              onClick={() => updateTextOverlay(clip.id, ov.id, { align: a.value as any })}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Slider
                        label="Posición X"
                        min={0} max={1} step={0.01}
                        value={ov.x} displayValue={`${Math.round(ov.x * 100)}%`}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { x: parseFloat(e.target.value) })}
                      />
                      <Slider
                        label="Posición Y"
                        min={0} max={1} step={0.01}
                        value={ov.y} displayValue={`${Math.round(ov.y * 100)}%`}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { y: parseFloat(e.target.value) })}
                      />

                      <Slider
                        label="Inicio (frames)"
                        min={0} max={clip.durationFrames - 1} step={1}
                        value={ov.startFrame} displayValue={ov.startFrame}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { startFrame: parseInt(e.target.value) })}
                      />
                      <Slider
                        label="Duración (frames)"
                        min={1} max={clip.durationFrames} step={1}
                        value={ov.durationFrames} displayValue={ov.durationFrames}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { durationFrames: parseInt(e.target.value) })}
                      />

                      <Select
                        label="Animación entrada"
                        value={ov.animationIn}
                        options={ANIMATIONS}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { animationIn: e.target.value as TextAnimation })}
                      />
                      <Select
                        label="Animación salida"
                        value={ov.animationOut}
                        options={ANIMATIONS.filter((a) => a.value !== 'typewriter' && a.value !== 'glitch')}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { animationOut: e.target.value as TextAnimation })}
                      />
                      <Slider
                        label="Duración animación (frames)"
                        min={1} max={60} step={1}
                        value={ov.animationDuration} displayValue={ov.animationDuration}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { animationDuration: parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
