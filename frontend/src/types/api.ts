export type JobStatus = 'queued' | 'bundling' | 'rendering' | 'completed' | 'error' | 'cancelled'

export interface RenderJob {
  jobId: string
  status: JobStatus
  progress: number
  message: string
  downloadUrl?: string
  framesRendered?: number
  totalFrames?: number
  fpsSpeed?: number
  eta?: number
  error?: string
}

export interface UploadedMedia {
  mediaId: string
  filename: string
  url: string
  type: 'image' | 'audio'
  durationSeconds?: number
  width?: number
  height?: number
  thumbnailUrl?: string
}

export interface RenderRequest {
  config: import('./video').VideoConfig
}

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
