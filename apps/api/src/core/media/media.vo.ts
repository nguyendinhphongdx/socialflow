import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { MediaAsset } from '@prisma/client'

export const MediaVoSchema = z.object({
  id: z.string(),
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  durationMs: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  publicUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  source: z.enum(['UPLOAD', 'AI_GEN', 'EXTERNAL_URL']),
  status: z.enum(['PENDING', 'UPLOADED', 'FAILED']),
  createdAt: z.date(),
})

export class MediaVo extends createZodDto(MediaVoSchema, 'MediaVo') {
  static create(entity: MediaAsset) {
    return MediaVoSchema.parse({
      id: entity.id,
      type: entity.type,
      filename: entity.filename,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      durationMs: entity.durationMs,
      width: entity.width,
      height: entity.height,
      publicUrl: entity.publicUrl,
      thumbnailUrl: entity.thumbnailUrl,
      source: entity.source,
      status: entity.status,
      createdAt: entity.createdAt,
    })
  }
}

export class MediaListVo extends createPaginationVo(MediaVoSchema, 'MediaListVo') {}

export const UploadUrlVoSchema = z.object({
  mediaId: z.string(),
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  publicUrl: z.string(),
  expiresIn: z.number().int(),
  headers: z.record(z.string(), z.string()),
})

export class UploadUrlVo extends createZodDto(UploadUrlVoSchema, 'UploadUrlVo') {}
