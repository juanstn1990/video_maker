import { create } from 'zustand'

interface TimelineStore {
  zoom: number              // px per frame
  scrollLeft: number
  currentFrame: number
  selectedClipId: string | null
  selectedOverlayId: string | null
  isDraggingScrubber: boolean

  setZoom: (zoom: number) => void
  setScrollLeft: (x: number) => void
  setCurrentFrame: (frame: number) => void
  selectClip: (id: string | null) => void
  selectOverlay: (id: string | null) => void
  setIsDraggingScrubber: (v: boolean) => void
}

export const useTimelineStore = create<TimelineStore>((set) => ({
  zoom: 2,
  scrollLeft: 0,
  currentFrame: 0,
  selectedClipId: null,
  selectedOverlayId: null,
  isDraggingScrubber: false,

  setZoom: (zoom) => set({ zoom: Math.max(0.3, Math.min(12, zoom)) }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setCurrentFrame: (currentFrame) => set({ currentFrame: Math.max(0, currentFrame) }),
  selectClip: (selectedClipId) => set({ selectedClipId, selectedOverlayId: null }),
  selectOverlay: (selectedOverlayId) => set({ selectedOverlayId }),
  setIsDraggingScrubber: (isDraggingScrubber) => set({ isDraggingScrubber }),
}))
