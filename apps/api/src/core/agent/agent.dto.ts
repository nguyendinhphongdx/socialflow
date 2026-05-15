import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'
import { PairClaimRequestSchema } from '@sociflow/ws-protocol'

/**
 * POST /agents/pair/init — empty body. JWT auth (user-facing web).
 * Có thể bỏ qua nhưng giữ DTO để Swagger có schema.
 */
export const PairInitDtoSchema = z.object({}).strict()
export class PairInitDto extends createZodDto(PairInitDtoSchema, 'PairInitDto') {}

/**
 * POST /agents/pair/claim — extension nhập code + device fingerprint.
 * Re-export schema từ ws-protocol để FE/extension dùng chung type.
 */
export const PairClaimDtoSchema = PairClaimRequestSchema
export class PairClaimDto extends createZodDto(PairClaimDtoSchema, 'PairClaimDto') {}

/**
 * GET /agents — list user's agents (excluding revoked by default).
 */
export const ListAgentsDtoSchema = PaginationDtoSchema.extend({
  online: z.coerce.boolean().optional()
    .describe('Lọc theo online state — true/false; bỏ qua để lấy tất cả'),
  includeRevoked: z.coerce.boolean().default(false)
    .describe('Include agent đã revoke'),
}).strict()
export class ListAgentsDto extends createZodDto(ListAgentsDtoSchema, 'ListAgentsDto') {}
