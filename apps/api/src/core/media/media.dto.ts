import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

// Limit theo type — image/video tightening theo security policy
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024            // 20 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024           // 500 MB
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024           // 200 MB

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const
export const AUDIO_MIME = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'] as const

export type AllowedImageMime = typeof IMAGE_MIME[number]
export type AllowedVideoMime = typeof VIDEO_MIME[number]
export type AllowedAudioMime = typeof AUDIO_MIME[number]
export type AllowedMime = AllowedImageMime | AllowedVideoMime | AllowedAudioMime

// MIME pattern explicit blacklist — SVG có thể chứa JS (XSS), HTML/JS arbitrary code,
// application/* có thể là binary executable. Reject sớm trong DTO.
const FORBIDDEN_MIME_PATTERNS = [
  /^image\/svg/i,
  /^text\//i,
  /^application\//i,
  /^script/i,
]

function isForbiddenMime(mime: string): boolean {
  return FORBIDDEN_MIME_PATTERNS.some(rx => rx.test(mime))
}

export const CreateUploadUrlDtoSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']).describe('Loại media'),
  filename: z.string().min(1).max(200).describe('Tên file gốc'),
  mimeType: z.string().min(3).max(100)
    .refine(v => !isForbiddenMime(v), { message: 'MIME type bị cấm (SVG/HTML/application/script)' })
    .describe('MIME type — chỉ chấp nhận image/video/audio cụ thể'),
  sizeBytes: z.coerce.number().int().positive().describe('Dung lượng bytes'),
  durationMs: z.coerce.number().int().nonnegative().optional().describe('Thời lượng ms (cho video/audio)'),
  width: z.coerce.number().int().nonnegative().optional(),
  height: z.coerce.number().int().nonnegative().optional(),
}).strict()
  .superRefine((data, ctx) => {
    if (data.type === 'IMAGE') {
      if (!IMAGE_MIME.includes(data.mimeType as AllowedImageMime)) {
        ctx.addIssue({ code: 'custom', path: ['mimeType'], message: `IMAGE chỉ hỗ trợ: ${IMAGE_MIME.join(', ')}` })
      }
      if (data.sizeBytes > MAX_IMAGE_BYTES) {
        ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `IMAGE vượt giới hạn ${MAX_IMAGE_BYTES} bytes` })
      }
      return
    }
    if (data.type === 'VIDEO') {
      if (!VIDEO_MIME.includes(data.mimeType as AllowedVideoMime)) {
        ctx.addIssue({ code: 'custom', path: ['mimeType'], message: `VIDEO chỉ hỗ trợ: ${VIDEO_MIME.join(', ')}` })
      }
      if (data.sizeBytes > MAX_VIDEO_BYTES) {
        ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `VIDEO vượt giới hạn ${MAX_VIDEO_BYTES} bytes` })
      }
      return
    }
    if (data.type === 'AUDIO') {
      if (!AUDIO_MIME.includes(data.mimeType as AllowedAudioMime)) {
        ctx.addIssue({ code: 'custom', path: ['mimeType'], message: `AUDIO chỉ hỗ trợ: ${AUDIO_MIME.join(', ')}` })
      }
      if (data.sizeBytes > MAX_AUDIO_BYTES) {
        ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `AUDIO vượt giới hạn ${MAX_AUDIO_BYTES} bytes` })
      }
    }
  })

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
