import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'
import { API_KEY_SCOPES } from './api-key.constants'

export const CreateApiKeyDtoSchema = z.object({
  name: z.string().min(1).max(120)
    .describe('Tên hiển thị cho key (vd: "Zapier integration")'),
  scopes: z.array(z.enum(API_KEY_SCOPES as [string, ...string[]]))
    .min(1)
    .max(API_KEY_SCOPES.length)
    .describe('Danh sách scope cấp cho key. Phải có ít nhất 1 scope.'),
  expiresAt: z.coerce.date().optional()
    .describe('Thời điểm hết hạn (ISO 8601). Bỏ trống = không hết hạn.'),
}).strict()

export class CreateApiKeyDto extends createZodDto(CreateApiKeyDtoSchema, 'CreateApiKeyDto') {}

export const ListApiKeysDtoSchema = PaginationDtoSchema.extend({
  includeRevoked: z.coerce.boolean().default(false)
    .describe('Bao gồm cả key đã revoke.'),
}).strict()

export class ListApiKeysDto extends createZodDto(ListApiKeysDtoSchema, 'ListApiKeysDto') {}
