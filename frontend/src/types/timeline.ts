export interface TimelineState {
  zoom: number              // px per frame, e.g. 2.0
  scrollLeft: number
  currentFrame: number
  selectedClipId: string | null
  selectedOverlayId: string | null
  isDraggingScrubber: boolean
}

export type DragType = 'move' | 'resizeLeft' | 'resizeRight' | 'scrubber'

export interface DragState {
  type: DragType
  clipId: string
  startX: number
  startFrame: number
  startDuration: number
  startIndex: number
}

export interface ClipTiming {
  startFrame: number
  durationFrames: number
}
