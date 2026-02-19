import { create } from 'zustand'
import type { UploadedMedia } from '../types/api'

interface MediaStore {
  items: UploadedMedia[]
  addMedia: (item: UploadedMedia) => void
  removeMedia: (mediaId: string) => void
  getMedia: (mediaId: string) => UploadedMedia | undefined
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  items: [],

  addMedia: (item) =>
    set((state) => ({ items: [...state.items, item] })),

  removeMedia: (mediaId) =>
    set((state) => ({ items: state.items.filter((m) => m.mediaId !== mediaId) })),

  getMedia: (mediaId) => get().items.find((m) => m.mediaId === mediaId),
}))
