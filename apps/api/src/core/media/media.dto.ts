import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024     // 2 GB
const MAX_IMAGE_BYTES = 20 * 1024 * 1024           // 20 MB
const MAX_AUDIO_BYTES = 200 * 1024 * 1024          // 200 MB

const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const AUDIO_MIME = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'] as const

export const CreateUploadUrlDtoSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']).describe('Loại media'),
  filename: z.string().min(1).max(200).describe('Tên file gốc'),
  mimeType: z.string().describe('MIME type (vd: video/mp4)'),
  sizeBytes: z.coerce.number().int().positive().describe('Dung lượng bytes'),
  durationMs: z.coerce.number().int().nonnegative().optional().describe('Thời lượng ms (cho video/audio)'),
  width: z.coerce.number().int().nonnegative().optional(),
  height: z.coerce.number().int().nonnegative().optional(),
}).strict()
  .refine((data) => {
    if (data.type === 'IMAGE') return data.sizeBytes <= MAX_IMAGE_BYTES && IMAGE_MIME.includes(data.mimeType as typeof IMAGE_MIME[number])
    if (data.type === 'VIDEO') return data.sizeBytes <= MAX_VIDEO_BYTES && VIDEO_MIME.includes(data.mimeType as typeof VIDEO_MIME[number])
    if (data.type === 'AUDIO') return data.sizeBytes <= MAX_AUDIO_BYTES && AUDIO_MIME.includes(data.mimeType as typeof AUDIO_MIME[number])
    return false
  }, { message: 'mime hoặc kích thước file không hợp lệ' })

export class CreateUploadUrlDto extends createZodDto(CreateUploadUrlDtoSchema, 'CreateUploadUrlDto') {}

export const ConfirmUploadDtoSchema = z.object({
  mediaId: z.string().cuid().describe('Media ID trả về từ /upload-url'),
}).strict()

export class ConfirmUploadDto extends createZodDto(ConfirmUploadDtoSchema, 'ConfirmUploadDto') {}

export const ListMediaDtoSchema = PaginationDtoSchema.extend({
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']).optional(),
  status: z.enum(['PENDING', 'UPLOADED', 'FAILED']).optional(),
}).strict()

export class ListMediaDto extends createZodDto(ListMediaDtoSchema, 'ListMediaDto') {}
