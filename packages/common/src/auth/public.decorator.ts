import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'sociflow:isPublic'

/**
 * Mark endpoint bypass `JwtAuthGuard`.
 * Dùng cho: `/auth/login`, `/auth/register`, `/health`, `/webhook/*`.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)
