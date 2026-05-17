import { z } from 'zod'
import type { ApiKey } from '@prisma/client'
import { createPaginationVo, createZodDto } from '@sociflow/common'

/**
 * VO cho list / get — KHÔNG bao giờ chứa raw key.
 */
export const ApiKeyVoSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string().describe('Phần đầu của key (đã hash) — hiển thị cho user nhận dạng'),
  scopes: z.array(z.string()),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class ApiKeyVo extends createZodDto(ApiKeyVoSchema, 'ApiKeyVo') {
  static create(entity: ApiKey) {
    return ApiKeyVoSchema.parse({
      id: entity.id,
      name: entity.name,
      prefix: entity.prefix,
      scopes: entity.scopes,
      lastUsedAt: entity.lastUsedAt,
      expiresAt: entity.expiresAt,
      revokedAt: entity.revokedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class ApiKeyListVo extends createPaginationVo(ApiKeyVoSchema, 'ApiKeyListVo') {}

/**
 * Response của `POST /api-keys` — return **raw key 1 lần duy nhất**.
 * Sau khi user rời màn hình, không có cách nào lấy lại.
 */
export const ApiKeyCreatedVoSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  rawKey: z.string()
    .describe('Raw API key — chỉ hiển thị 1 lần. Lưu lại ngay, không thể xem lại.'),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
})

export class ApiKeyCreatedVo extends createZodDto(ApiKeyCreatedVoSchema, 'ApiKeyCreatedVo') {
  static fromEntity(entity: ApiKey, rawKey: string) {
    return ApiKeyCreatedVoSchema.parse({
      id: entity.id,
      name: entity.name,
      prefix: entity.prefix,
      scopes: entity.scopes,
      rawKey,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
    })
  }
}
