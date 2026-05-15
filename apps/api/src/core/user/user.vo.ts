import { z } from 'zod'
import { createZodDto } from '@sociflow/common'
import type { User } from '@prisma/client'

export const UserVoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  emailVerified: z.boolean(),
  locale: z.string(),
  planTier: z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  aiCredits: z.number().int(),
  createdAt: z.date(),
})

export class UserVo extends createZodDto(UserVoSchema, 'UserVo') {
  static create(user: User) {
    return UserVoSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      locale: user.locale,
      planTier: user.planTier,
      aiCredits: user.aiCredits,
      createdAt: user.createdAt,
    })
  }
}
