import { Inject, Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import type { AuthUser } from '@sociflow/common'
import { cookieOrBearerExtractor } from '../extractors'
import type { JwtPayload } from '../jwt-payload.type'

export const JWT_AUTH_OPTIONS = 'JWT_AUTH_OPTIONS'

export interface JwtAuthOptions {
  jwtAccessSecret: string
  accessCookieName: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(JWT_AUTH_OPTIONS) options: JwtAuthOptions) {
    super({
      jwtFromRequest: cookieOrBearerExtractor(options.accessCookieName),
      secretOrKey: options.jwtAccessSecret,
      ignoreExpiration: false,
    })
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    }
  }
}
