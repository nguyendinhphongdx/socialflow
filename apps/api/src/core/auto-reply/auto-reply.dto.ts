import { z } from 'zod'
import { AccountPlatform } from '@prisma/client'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

const PlatformEnum = z.nativeEnum(AccountPlatform)

const KeywordsSchema = z.array(z.string().trim().min(1).max(200)).max(50)

export const CreateAutoReplyRuleDtoSchema = z.object({
  name: z.string().trim().min(1).max(100)
    .describe('Tên rule hiển thị cho user'),
  enabled: z.boolean().default(true)
    .describe('Bật / tắt rule'),
  platforms: z.array(PlatformEnum).min(1).max(10)
    .describe('Áp dụng cho platform nào'),
  accountIds: z.array(z.string().cuid()).max(200).default([])
    .describe('Giới hạn theo account (cuid). Để rỗng = áp dụng tất cả account của user'),
  keywordsAny: KeywordsSchema.min(1)
    .describe('Match nếu chứa BẤT KỲ keyword nào (case-insensitive). Bắt buộc ít nhất 1'),
  keywordsAll: KeywordsSchema.default([])
    .describe('Match nếu chứa TẤT CẢ keywords'),
  keywordsNone: KeywordsSchema.default([])
    .describe('Bỏ qua nếu chứa BẤT KỲ keyword nào (exclude)'),
  replyTemplate: z.string().trim().min(1).max(2000)
    .describe('Nội dung reply. Hỗ trợ biến: {{authorName}}, {{postTitle}}'),
  replyDelaySec: z.number().int().min(0).max(3600).default(60)
    .describe('Delay (giây) trước khi gửi reply — chống bot-detect. Max 1h'),
  maxRepliesPerDay: z.number().int().min(1).max(1000).default(50)
    .describe('Quota reply / ngày / rule. Reset lúc 00:00 UTC'),
}).strict()

export class CreateAutoReplyRuleDto extends createZodDto(
  CreateAutoReplyRuleDtoSchema,
  'CreateAutoReplyRuleDto',
) {}

export const UpdateAutoReplyRuleDtoSchema = CreateAutoReplyRuleDtoSchema.partial()

export class UpdateAutoReplyRuleDto extends createZodDto(
  UpdateAutoReplyRuleDtoSchema,
  'UpdateAutoReplyRuleDto',
) {}

export const ListAutoReplyRuleDtoSchema = PaginationDtoSchema.extend({
  enabled: z.coerce.boolean().optional()
    .describe('Lọc theo trạng thái bật / tắt'),
  platform: PlatformEnum.optional()
    .describe('Lọc theo platform'),
}).strict()

export class ListAutoReplyRuleDto extends createZodDto(
  ListAutoReplyRuleDtoSchema,
  'ListAutoReplyRuleDto',
) {}
