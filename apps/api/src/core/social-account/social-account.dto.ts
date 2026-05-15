import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

export const ListSocialAccountDtoSchema = PaginationDtoSchema.extend({
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']).optional()
    .describe('Filter theo platform'),
  status: z.enum(['ACTIVE', 'TOKEN_EXPIRED', 'REVOKED', 'SUSPENDED']).optional(),
}).strict()

export class ListSocialAccountDto extends createZodDto(ListSocialAccountDtoSchema, 'ListSocialAccountDto') {}

export const ConnectYouTubeDtoSchema = z.object({
  returnUrl: z.string().url().optional()
    .describe('URL redirect về sau khi connect xong'),
  groupId: z.string().cuid().optional()
    .describe('Account group muốn add account vào'),
}).strict()

export class ConnectYouTubeDto extends createZodDto(ConnectYouTubeDtoSchema, 'ConnectYouTubeDto') {}
