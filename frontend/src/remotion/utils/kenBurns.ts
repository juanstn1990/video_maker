import { interpolate } from 'remotion'
import type { KenBurnsConfig } from '../../types/video'

const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
}

export interface KenBurnsResult {
  scale: number
  translateX: number
  translateY: number
}

export function applyKenBurns(
  config: KenBurnsConfig,
  frame: number,
  totalFrames: number,
): KenBurnsResult {
  const raw = interpolate(frame, [0, Math.max(1, totalFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const eased = easings[config.easing](raw)

  const scale = config.startScale + (config.endScale - config.startScale) * eased
  const panX = config.startX + (config.endX - config.startX) * eased
  const panY = config.startY + (config.endY - config.startY) * eased

  // Divide by scale so translation stays in screen-space units
  const translateX = (panX * 100) / scale
  const translateY = (panY * 100) / scale

  return { scale, translateX, translateY }
}

export const KEN_BURNS_PRESETS: Record<string, KenBurnsConfig> = {
  none: {
    startX: 0, startY: 0, startScale: 1.0,
    endX: 0,   endY: 0,   endScale: 1.0,
    easing: 'linear',
  },
  zoomIn: {
    startX: 0, startY: 0, startScale: 1.0,
    endX: 0,   endY: 0,   endScale: 1.3,
    easing: 'easeInOut',
  },
  zoomOut: {
    startX: 0, startY: 0, startScale: 1.3,
    endX: 0,   endY: 0,   endScale: 1.0,
    easing: 'easeInOut',
  },
  panLeft: {
    startX: 0.1,  startY: 0, startScale: 1.2,
    endX: -0.1,   endY: 0,   endScale: 1.2,
    easing: 'easeInOut',
  },
  panRight: {
    startX: -0.1, startY: 0, startScale: 1.2,
    endX: 0.1,    endY: 0,   endScale: 1.2,
    easing: 'easeInOut',
  },
  panUp: {
    startX: 0, startY: 0.1,  startScale: 1.2,
    endX: 0,   endY: -0.1,   endScale: 1.2,
    easing: 'easeInOut',
  },
  panDown: {
    startX: 0, startY: -0.1, startScale: 1.2,
    endX: 0,   endY: 0.1,    endScale: 1.2,
    easing: 'easeInOut',
  },
  zoomInPanRight: {
    startX: -0.08, startY: 0.03, startScale: 1.0,
    endX: 0.08,    endY: -0.03,  endScale: 1.35,
    easing: 'easeInOut',
  },
  zoomOutPanLeft: {
    startX: 0.08,  startY: -0.03, startScale: 1.35,
    endX: -0.08,   endY: 0.03,    endScale: 1.0,
    easing: 'easeInOut',
  },
}

export const KEN_BURNS_PRESET_NAMES: Record<string, string> = {
  none: 'Estático',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  panLeft: 'Pan Izquierda',
  panRight: 'Pan Derecha',
  panUp: 'Pan Arriba',
  panDown: 'Pan Abajo',
  zoomInPanRight: 'Zoom In + Pan',
  zoomOutPanLeft: 'Zoom Out + Pan',
}
