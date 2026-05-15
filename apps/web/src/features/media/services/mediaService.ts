import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  CreateUploadUrlInput,
  MediaAsset,
  UploadUrlResponse,
} from '../types'

export const mediaService = {
  createUploadUrl: async (input: CreateUploadUrlInput): Promise<UploadUrlResponse> => {
    const { data } = await apiClient.post<ApiResponse<UploadUrlResponse>>('/media/upload-url', input)
    return data.data
  },
  confirm: async (mediaId: string): Promise<MediaAsset> => {
    const { data } = await apiClient.post<ApiResponse<MediaAsset>>('/media/confirm', { mediaId })
    return data.data
  },
  getById: async (id: string): Promise<MediaAsset> => {
    const { data } = await apiClient.get<ApiResponse<MediaAsset>>(`/media/${id}`)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/media/${id}`)
  },
}

/**
 * PUT file lên pre-signed URL với progress callback.
 *
 * Note: dùng XMLHttpRequest thay fetch để có upload progress.
 * `fetch()` chưa support upload progress (theo Streams API spec WIP).
 */
export function uploadToPresignedUrl(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    Object.entries(headers).forEach(([key, val]) => xhr.setRequestHeader(key, val))
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total)
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Upload network error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
    xhr.send(file)
  })
}

/**
 * Detect media type từ MIME.
 */
export function inferMediaType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | null {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  return null
}

/**
 * Đọc duration ms cho video/audio (qua <video>/<audio> element).
 */
export function probeDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith('video/')
    const el = document.createElement(isVideo ? 'video' : 'audio') as HTMLMediaElement
    el.preload = 'metadata'
    el.src = url
    el.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(el.duration > 0 ? Math.round(el.duration * 1000) : undefined)
    })
    el.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    })
  })
}

/**
 * Đọc dimension cho image.
 */
export function probeImageDimensions(file: File): Promise<{ width?: number, height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({})
    }
    img.src = url
  })
}
