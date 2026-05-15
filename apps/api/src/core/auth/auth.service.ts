import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService, SessionRepository, type JwtPayload } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserRepository } from '../user/user.repository'
import type { LoginDto, RegisterDto } from './auth.dto'

interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number     // seconds
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly jwt: JwtService,
    private readonly ctx: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.userRepo.existsByEmail(dto.email)
    if (exists) throw new AppException(ResponseCode.EmailAlreadyExists)

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.userRepo.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      emailVerified: false,
    })

    const tokens = await this.issueTokensForUser(user.id, user.email, user.role)
    return { user, tokens }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.getByEmail(dto.email)
    if (!user || !user.passwordHash) {
      throw new AppException(ResponseCode.InvalidCredentials)
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash)
    if (!ok) throw new AppException(ResponseCode.InvalidCredentials)

    const tokens = await this.issueTokensForUser(user.id, user.email, user.role)
    return { user, tokens }
  }

  async refresh(oldRefreshToken: string) {
    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(oldRefreshToken, {
        secret: this.config.auth.jwtRefreshSecret,
      })
    }
    catch {
      throw new AppException(ResponseCode.RefreshTokenInvalid)
    }

    const newRefreshToken = this.generateOpaqueRefresh()
    const expiresAt = this.computeExpiresAt(this.config.auth.jwtRefreshExpiration)

    const result = await this.sessionRepo.rotate(oldRefreshToken, {
      userId: payload.sub,
      refreshToken: newRefreshToken,
      expiresAt,
      userAgent: this.ctx.userAgent,
      ipAddress: this.ctx.ip,
    })

    if (result.kind === 'replay') {
      const revoked = await this.sessionRepo.revokeAllByUserId(result.userId)
      this.logger.warn(`Refresh replay detected for user ${result.userId} — revoked ${revoked} sessions`)
      throw new AppException(ResponseCode.RefreshTokenReused)
    }

    const accessToken = await this.signAccess({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: result.newSession.id,
    })

    const signedRefresh = await this.signRefresh({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: result.newSession.id,
    })

    return {
      tokens: {
        accessToken,
        refreshToken: signedRefresh,
        expiresIn: this.parseExpirationSeconds(this.config.auth.jwtAccessExpiration),
      },
    }
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.auth.jwtRefreshSecret,
      })
      await this.sessionRepo.revokeByRefreshTokenHash(payload.sessionId)
    }
    catch {
      // logout idempotent — token invalid không error
    }
  }

  private async issueTokensForUser(userId: string, email: string, role: 'USER' | 'ADMIN'): Promise<IssuedTokens> {
    const refreshToken = this.generateOpaqueRefresh()
    const expiresAt = this.computeExpiresAt(this.config.auth.jwtRefreshExpiration)
    const session = await this.sessionRepo.create({
      userId,
      refreshToken,
      expiresAt,
      userAgent: this.ctx.userAgent,
      ipAddress: this.ctx.ip,
    })

    const accessToken = await this.signAccess({ sub: userId, email, role, sessionId: session.id })
    const signedRefresh = await this.signRefresh({ sub: userId, email, role, sessionId: session.id })

    return {
      accessToken,
      refreshToken: signedRefresh,
      expiresIn: this.parseExpirationSeconds(this.config.auth.jwtAccessExpiration),
    }
  }

  private signAccess(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.auth.jwtAccessSecret,
      expiresIn: this.config.auth.jwtAccessExpiration as unknown as number,
    })
  }

  private signRefresh(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.auth.jwtRefreshSecret,
      expiresIn: this.config.auth.jwtRefreshExpiration as unknown as number,
    })
  }

  private generateOpaqueRefresh(): string {
    return randomBytes(48).toString('base64url')
  }

  private parseExpirationSeconds(input: string): number {
    const match = input.match(/^(\d+)([smhd])$/)
    if (!match) return 900
    const [, num, unit] = match
    const value = Number.parseInt(num!, 10)
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit!] ?? 60
    return value * mult
  }

  private computeExpiresAt(input: string): Date {
    return new Date(Date.now() + this.parseExpirationSeconds(input) * 1000)
  }
}
