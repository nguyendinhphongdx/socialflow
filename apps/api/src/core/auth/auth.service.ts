import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { EventEmitter2 } from '@nestjs/event-emitter'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService, SessionRepository, type JwtPayload } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserRepository } from '../user/user.repository'
import { WorkspaceService } from '../workspace/workspace.service'
import type { LoginDto, RegisterDto } from './auth.dto'

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number     // seconds
}

/**
 * Pre-computed bcrypt hash của một password placeholder không bao giờ match.
 * Dùng để `bcrypt.compare` chạy work-factor 12 round khi user không tồn tại
 * → request latency hằng định (chống user-enumeration qua timing).
 *
 * Hash sinh từ chuỗi random 32-byte với cost factor 12 (cùng cost với real password).
 */
const DUMMY_PASSWORD_HASH = '$2a$12$BewKYkIcqtLc3XUhMz.leedb/h9uGsEG8uovUWHIqWlg6rpZ9vgry'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly jwt: JwtService,
    private readonly ctx: RequestContextService,
    private readonly events: EventEmitter2,
    private readonly workspaceService: WorkspaceService,
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

    // F-716 — tạo personal workspace + WorkspaceMember(OWNER) atomic.
    const workspace = await this.workspaceService.ensurePersonalWorkspace(user.id, user.name)
    const tokens = await this.issueTokensForUser(user.id, user.email, user.role, workspace.id)

    // Emit `auth.user-registered` → NotificationService gửi verify-email
    const verifyToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'verify-email' },
      { secret: this.config.auth.jwtAccessSecret, expiresIn: '24h' },
    )
    this.events.emit('auth.user-registered', {
      userId: user.id,
      email: user.email,
      name: user.name,
      verifyUrl: `${this.config.web.appUrl}/verify-email?token=${verifyToken}`,
      expireAt: new Date(Date.now() + 24 * 3600 * 1000),
    })

    return { user, tokens }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.getByEmail(dto.email)
    // Chạy bcrypt.compare dù user không tồn tại / không có password — request
    // latency hằng định cho mọi case (chống user-enumeration qua timing).
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH
    const ok = await bcrypt.compare(dto.password, passwordHash)
    if (!user || !user.passwordHash || !ok) {
      throw new AppException(ResponseCode.InvalidCredentials)
    }

    // F-716 — resolve primary workspace (personal nếu chưa có team workspace).
    // ensurePersonalWorkspace idempotent — không tạo trùng nếu đã có.
    const workspace = await this.workspaceService.ensurePersonalWorkspace(user.id, user.name)
    const tokens = await this.issueTokensForUser(user.id, user.email, user.role, workspace.id)
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

    // F-716 — preserve workspaceId từ token cũ. Nếu không có (legacy token),
    // resolve personal workspace từ membership.
    const workspaceId = payload.workspaceId
      ?? (await this.workspaceService.resolvePersonalWorkspaceId(payload.sub))
      ?? undefined

    const accessToken = await this.signAccess({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: result.newSession.id,
      workspaceId,
    })

    const signedRefresh = await this.signRefresh({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: result.newSession.id,
      workspaceId,
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
    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.auth.jwtRefreshSecret,
      })
    }
    catch {
      // logout idempotent — token invalid không error
      return
    }
    if (!payload.sessionId) return
    await this.sessionRepo.revokeBySessionId(payload.sessionId)
  }

  /**
   * F-713 — Data deletion request (Meta App Review requirement).
   * Soft-delete user + revoke all sessions + emit `user.deletion-requested` event.
   * Hard delete sau 30 ngày qua cron (cleanup-soft-deleted CLI command).
   */
  async requestDataDeletion(userId: string): Promise<{ confirmationCode: string }> {
    const user = await this.userRepo.getById(userId)
    if (!user) throw new AppException(ResponseCode.UserNotFound, { userId })

    await this.sessionRepo.revokeAllByUserId(userId)
    await this.userRepo.softDeleteById(userId)
    this.logger.warn(`Data deletion requested for user ${userId} (${user.email}) — hard delete in 30 days`)

    // Confirmation code = sha256(userId + deletion timestamp) prefix 16 chars
    const code = createHash('sha256')
      .update(`${userId}-${Date.now()}`)
      .digest('hex')
      .slice(0, 16)
    return { confirmationCode: code }
  }

  private async issueTokensForUser(
    userId: string,
    email: string,
    role: 'USER' | 'ADMIN',
    workspaceId?: string,
  ): Promise<IssuedTokens> {
    const refreshToken = this.generateOpaqueRefresh()
    const expiresAt = this.computeExpiresAt(this.config.auth.jwtRefreshExpiration)
    const session = await this.sessionRepo.create({
      userId,
      refreshToken,
      expiresAt,
      userAgent: this.ctx.userAgent,
      ipAddress: this.ctx.ip,
    })

    const accessToken = await this.signAccess({ sub: userId, email, role, sessionId: session.id, workspaceId })
    const signedRefresh = await this.signRefresh({ sub: userId, email, role, sessionId: session.id, workspaceId })

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
