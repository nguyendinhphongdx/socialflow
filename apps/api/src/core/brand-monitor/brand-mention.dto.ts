import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

export const SentimentLabelEnum = z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL'])
export const MentionStatusEnum = z.enum(['NEW', 'ACKED', 'ARCHIVED'])

export const ListBrandMentionDtoSchema = PaginationDtoSchema.extend({
  monitorId: z.string().cuid().optional()
    .describe('Filter theo brand monitor'),
  sentiment: SentimentLabelEnum.optional()
    .describe('Filter theo sentiment'),
  status: MentionStatusEnum.optional()
    .describe('Filter theo status'),
}).strict()

export class ListBrandMentionDto extends createZodDto(ListBrandMentionDtoSchema, 'ListBrandMentionDto') {}
