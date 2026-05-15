import { z } from 'zod'
import { createZodDto } from '@sociflow/common'
import { UserVoSchema } from '../user/user.vo'

export const AuthTokensVoSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
})

export const AuthResultVoSchema = z.object({
  user: UserVoSchema,
  tokens: AuthTokensVoSchema,
})

export class AuthResultVo extends createZodDto(AuthResultVoSchema, 'AuthResultVo') {}
