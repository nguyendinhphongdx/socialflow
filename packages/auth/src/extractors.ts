import { ExtractJwt, type JwtFromRequestFunction } from 'passport-jwt'
import type { Request } from 'express'

/**
 * Cookie-first JWT extractor với Bearer header fallback.
 *
 * - Web (`apps/web`) gửi cookie httpOnly tự động (`withCredentials: true`)
 * - Extension / mobile / 3rd-party gửi `Authorization: Bearer <token>`
 */
export function cookieOrBearerExtractor(cookieName: string): JwtFromRequestFunction {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()
  return (req: Request | undefined) => {
    const fromCookie = (req as Request & { cookies?: Record<string, string> })?.cookies?.[cookieName]
    return fromCookie ?? fromHeader(req as Request)
  }
}
