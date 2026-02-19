export interface UploadResponse {
  mediaId: string
  filename: string
  url: string
  type: 'image' | 'audio'
  width?: number
  height?: number
  thumbnailUrl?: string
  durationSeconds?: number
}
