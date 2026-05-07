export interface UploadResponse {
  mediaId: string
  filename: string
  url: string
  type: 'image' | 'audio' | 'video'
  width?: number
  height?: number
  thumbnailUrl?: string
  durationSeconds?: number
}
