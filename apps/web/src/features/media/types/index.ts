export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO'
export type MediaStatus = 'PENDING' | 'UPLOADED' | 'FAILED'
export type MediaSource = 'UPLOAD' | 'AI_GEN' | 'EXTERNAL_URL'

export interface MediaAsset {
  id: string
  type: MediaType
  filename: string
  mimeType: string
  sizeBytes: number
  durationMs: number | null
  width: number | null
  height: number | null
  publicUrl: string
  thumbnailUrl: string | null
  source: MediaSource
  status: MediaStatus
  createdAt: string
}

export interface CreateUploadUrlInput {
  type: MediaType
  filename: string
  mimeType: string
  sizeBytes: number
  durationMs?: number
  width?: number
  height?: number
}

export interface UploadUrlResponse {
  mediaId: string
  uploadUrl: string
  storageKey: string
  publicUrl: string
  expiresIn: number
  headers: Record<string, string>
}

export interface UploadProgress {
  mediaId: string | null
  filename: string
  loaded: number
  total: number
  status: 'preparing' | 'uploading' | 'confirming' | 'done' | 'error'
  error?: string
}
