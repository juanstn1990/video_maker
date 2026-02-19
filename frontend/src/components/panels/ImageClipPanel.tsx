import { useState } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { Slider } from '../ui/Slider'
import { Select } from '../ui/Select'
import { ColorInput } from '../ui/ColorInput'
import { Button } from '../ui/Button'
import { FONT_OPTIONS } from '../../constants/fonts'
import type { ImageClipConfig, ImageFitMode, TextAnimation } from '../../types/video'

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

const KB_PRESETS = [
  { label: 'Sin efecto', startX: 0, startY: 0, startScale: 1, endX: 0, endY: 0, endScale: 1 },
  { label: 'Zoom In', startX: 0, startY: 0, startScale: 1, endX: 0, endY: 0, endScale: 1.3 },
  { label: 'Zoom Out', startX: 0, startY: 0, startScale: 1.3, endX: 0, endY: 0, endScale: 1 },
  { label: 'Pan Derecha', startX: -0.1, startY: 0, startScale: 1.1, endX: 0.1, endY: 0, endScale: 1.1 },
  { label: 'Pan Izq', startX: 0.1, startY: 0, startScale: 1.1, endX: -0.1, endY: 0, endScale: 1.1 },
  { label: 'Pan Arriba', startX: 0, startY: 0.1, startScale: 1.1, endX: 0, endY: -0.1, endScale: 1.1 },
  { label: 'Pan Abajo', startX: 0, startY: -0.1, startScale: 1.1, endX: 0, endY: 0.1, endScale: 1.1 },
  { label: 'Diagonal', startX: -0.1, startY: 0.1, startScale: 1, endX: 0.1, endY: -0.1, endScale: 1.3 },
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

function ApplyAllBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="text-[10px] text-indigo-400 hover:text-indigo-200 transition-colors ml-auto"
      onClick={onClick}
      title="Aplicar a todas las imágenes"
    >
      Aplicar a todas
    </button>
  )
}

interface Props { clip: ImageClipConfig }

export function ImageClipPanel({ clip }: Props) {
  const {
    updateImageClip, updateKenBurns, updateTransition,
    addTextOverlay, removeTextOverlay, updateTextOverlay, config,
    applyTransitionToAllImages, applyKenBurnsToAllImages, applyAdjustmentsToAllImages,
  } = useEditorStore()
  const fps = config.fps
  const durationSec = clip.durationFrames / fps
  const [expandedOverlay, setExpandedOverlay] = useState<string | null>(null)

  return (
    <div className="space-y-4 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clip de Imagen</h3>

      {/* Duration */}
      <Slider
        label="Duración"
        min={fps * 0.5}
        max={fps * 30}
        step={fps * 0.5}
        value={clip.durationFrames}
        displayValue={`${Math.round(durationSec * 10) / 10}s`}
        onChange={(e) => updateImageClip(clip.id, { durationFrames: parseInt(e.target.value) })}
      />

      {/* Static Framing */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">Encuadre</h4>

        {/* Fit mode */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Ajuste de imagen</label>
          <div className="grid grid-cols-3 gap-1">
            {([
              { value: 'cover', label: 'Recortar', desc: 'Llena el encuadre (recorta)' },
              { value: 'contain', label: 'Completa', desc: 'Imagen completa (barras negras)' },
              { value: 'fill', label: 'Estirar', desc: 'Estira para llenar' },
            ] as { value: ImageFitMode; label: string; desc: string }[]).map((opt) => (
              <button
                key={opt.value}
                title={opt.desc}
                className={`text-[10px] rounded px-1 py-1.5 transition-colors text-center ${
                  (clip.fitMode ?? 'cover') === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
                onClick={() => updateImageClip(clip.id, { fitMode: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="Zoom"
          min={0.3}
          max={4}
          step={0.05}
          value={clip.cropZoom ?? 1}
          displayValue={`${Math.round((clip.cropZoom ?? 1) * 100)}%`}
          onChange={(e) => updateImageClip(clip.id, { cropZoom: parseFloat(e.target.value) })}
        />
        <Slider
          label="Girar"
          min={-180}
          max={180}
          step={1}
          value={clip.rotation ?? 0}
          displayValue={`${clip.rotation ?? 0}°`}
          onChange={(e) => updateImageClip(clip.id, { rotation: parseInt(e.target.value) })}
        />
        <Slider
          label="Desplazar X"
          min={-1}
          max={1}
          step={0.01}
          value={clip.cropX ?? 0}
          displayValue={`${Math.round((clip.cropX ?? 0) * 100)}%`}
          onChange={(e) => updateImageClip(clip.id, { cropX: parseFloat(e.target.value) })}
        />
        <Slider
          label="Desplazar Y"
          min={-1}
          max={1}
          step={0.01}
          value={clip.cropY ?? 0}
          displayValue={`${Math.round((clip.cropY ?? 0) * 100)}%`}
          onChange={(e) => updateImageClip(clip.id, { cropY: parseFloat(e.target.value) })}
        />
        {(clip.cropZoom !== 1 || clip.rotation !== 0 || clip.cropX !== 0 || clip.cropY !== 0) && (
          <button
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
            onClick={() => updateImageClip(clip.id, { cropZoom: 1, rotation: 0, cropX: 0, cropY: 0 })}
          >
            Restablecer encuadre
          </button>
        )}
      </div>

      {/* Ken Burns */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center mb-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider">Ken Burns</h4>
          <ApplyAllBtn onClick={() => applyKenBurnsToAllImages(clip.kenBurns)} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {KB_PRESETS.map((p) => (
            <button
              key={p.label}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] rounded px-1 py-1 transition-colors text-center"
              onClick={() => updateKenBurns(clip.id, {
                startX: p.startX, startY: p.startY, startScale: p.startScale,
                endX: p.endX, endY: p.endY, endScale: p.endScale,
              })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Slider
            label="Escala inicio"
            min={0.8}
            max={2}
            step={0.05}
            value={clip.kenBurns.startScale}
            displayValue={clip.kenBurns.startScale.toFixed(2)}
            onChange={(e) => updateKenBurns(clip.id, { startScale: parseFloat(e.target.value) })}
          />
          <Slider
            label="Escala fin"
            min={0.8}
            max={2}
            step={0.05}
            value={clip.kenBurns.endScale}
            displayValue={clip.kenBurns.endScale.toFixed(2)}
            onChange={(e) => updateKenBurns(clip.id, { endScale: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      {/* Adjustments */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <div className="flex items-center">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider">Ajustes</h4>
          <ApplyAllBtn
            onClick={() => applyAdjustmentsToAllImages(clip.brightness, clip.contrast, clip.saturation)}
          />
        </div>
        <Slider
          label="Brillo"
          min={-1} max={1} step={0.05}
          value={clip.brightness} displayValue={clip.brightness.toFixed(2)}
          onChange={(e) => updateImageClip(clip.id, { brightness: parseFloat(e.target.value) })}
        />
        <Slider
          label="Contraste"
          min={-1} max={1} step={0.05}
          value={clip.contrast} displayValue={clip.contrast.toFixed(2)}
          onChange={(e) => updateImageClip(clip.id, { contrast: parseFloat(e.target.value) })}
        />
        <Slider
          label="Saturación"
          min={-1} max={1} step={0.05}
          value={clip.saturation} displayValue={clip.saturation.toFixed(2)}
          onChange={(e) => updateImageClip(clip.id, { saturation: parseFloat(e.target.value) })}
        />
      </div>

      {/* Transition */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <div className="flex items-center">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider">Transición</h4>
          <ApplyAllBtn onClick={() => applyTransitionToAllImages(clip.transitionIn)} />
        </div>
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
                  {/* Header row */}
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

                  {/* Expanded editor */}
                  {isOpen && (
                    <div className="px-2 pb-3 space-y-2 border-t border-gray-700 pt-2">
                      {/* Text */}
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Texto</label>
                        <textarea
                          className="w-full bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          rows={2}
                          value={ov.text}
                          onChange={(e) => updateTextOverlay(clip.id, ov.id, { text: e.target.value })}
                        />
                      </div>

                      {/* Font */}
                      <Select
                        label="Fuente"
                        value={ov.fontFamily}
                        options={FONT_OPTIONS}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { fontFamily: e.target.value })}
                      />

                      <Slider
                        label="Tamaño"
                        min={16} max={200} step={2}
                        value={ov.fontSize} displayValue={`${ov.fontSize}px`}
                        onChange={(e) => updateTextOverlay(clip.id, ov.id, { fontSize: parseInt(e.target.value) })}
                      />

                      {/* Colors */}
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

                      {/* Bold / Italic / Align */}
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

                      {/* Position */}
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

                      {/* Timing */}
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

                      {/* Animations */}
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
