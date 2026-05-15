'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  inferMediaType,
  mediaService,
  probeDuration,
  probeImageDimensions,
  uploadToPresignedUrl,
} from '../services/mediaService'
import type { MediaAsset, UploadProgress } from '../types'

interface UploadResult {
  mediaId: string
  publicUrl: string
}

/**
 * Hook upload 1 hoặc nhiều file.
 *
 * Flow per file:
 * 1. infer type + probe metadata (duration, dimensions)
 * 2. POST /media/upload-url → get presign + mediaId
 * 3. PUT file lên presign URL (progress callback)
 * 4. POST /media/confirm → mark UPLOADED
 */
export function useMediaUpload() {
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const uploadFiles = useCallback(async (files: File[]): Promise<MediaAsset[]> => {
    setIsUploading(true)
    setProgress(files.map(f => ({
      mediaId: null,
      filename: f.name,
      loaded: 0,
      total: f.size,
      status: 'preparing' as const,
    })))

    const uploaded: MediaAsset[] = []

    for (const [idx, file] of files.entries()) {
      const type = inferMediaType(file.type)
      if (!type) {
        toast.error(`File ${file.name}: định dạng không hỗ trợ`)
        updateProgress(idx, { status: 'error', error: 'unsupported_type' })
        continue
      }

      try {
        const meta: { durationMs?: number, width?: number, height?: number } = {}
        if (type === 'IMAGE') {
          Object.assign(meta, await probeImageDimensions(file))
        }
        else {
          meta.durationMs = await probeDuration(file)
        }

        const presign = await mediaService.createUploadUrl({
          type,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          ...meta,
        })
        updateProgress(idx, { mediaId: presign.mediaId, status: 'uploading' })

        await uploadToPresignedUrl(
          presign.uploadUrl,
          file,
          presign.headers,
          (loaded, total) => updateProgress(idx, { loaded, total }),
        )
        updateProgress(idx, { status: 'confirming' })

        const asset = await mediaService.confirm(presign.mediaId)
        updateProgress(idx, { status: 'done' })
        uploaded.push(asset)
      }
      catch (err) {
        const message = err instanceof Error ? err.message : 'upload_failed'
        toast.error(`Upload ${file.name} thất bại: ${message}`)
        updateProgress(idx, { status: 'error', error: message })
      }
    }

    setIsUploading(false)
    if (uploaded.length > 0) {
      toast.success(`Upload ${uploaded.length}/${files.length} file thành công`)
    }
    return uploaded
  }, [])

  function updateProgress(index: number, patch: Partial<UploadProgress>) {
    setProgress(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  const reset = useCallback(() => setProgress([]), [])

  return { uploadFiles, progress, isUploading, reset }
}

export type { UploadResult }
