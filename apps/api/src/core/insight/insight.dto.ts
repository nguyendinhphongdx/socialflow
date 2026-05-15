import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const AccountTimelineQueryDtoSchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30)
    .describe('Số ngày timeline cần trả về (1-180, mặc định 30)'),
}).strict()

export class AccountTimelineQueryDto extends createZodDto(AccountTimelineQueryDtoSchema, 'AccountTimelineQueryDto') {}
