import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { ApiDoc, AppException, CurrentUser, type AuthUser, Public, ResponseCode } from '@sociflow/common'
import { clearAuthCookies, setAuthCookies, type AuthCookieConfig } from '@sociflow/auth'
import { AuthService } from './auth.service'
import { LoginDto, RegisterDto } from './auth.dto'
import { AuthResultVo } from './auth.vo'
import { UserVo } from '../user/user.vo'
import { APP_CONFIG, type AppConfig } from '../../config'

@ApiTags('Auth')
@Controller('/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDoc({ summary: 'Đăng ký tài khoản', body: RegisterDto, response: AuthResultVo })
  @Post('/register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(dto)
    setAuthCookies(res, tokens, this.cookieConfig())
    return { user: UserVo.create(user), tokens }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDoc({ summary: 'Đăng nhập', body: LoginDto, response: AuthResultVo })
  @Post('/login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto)
    setAuthCookies(res, tokens, this.cookieConfig())
    return { user: UserVo.create(user), tokens }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDoc({ summary: 'Refresh access + refresh token (single-use rotation)' })
  @Post('/refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[this.config.auth.refreshCookieName]
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken
    const token = fromCookie ?? fromBody
    if (!token) throw new AppException(ResponseCode.RefreshTokenInvalid)

    const { tokens } = await this.auth.refresh(token)
    setAuthCookies(res, tokens, this.cookieConfig())
    return { tokens }
  }

  @Public()
  @ApiDoc({ summary: 'Đăng xuất — revoke session, clear cookies' })
  @Post('/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[this.config.auth.refreshCookieName]
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken
    await this.auth.logout(fromCookie ?? fromBody)
    clearAuthCookies(res, this.cookieConfig())
    return { ok: true }
  }

  /**
   * F-713 — Data deletion request (Meta App Review requirement).
   * Soft-delete user → hard delete sau 30 ngày qua cron. Idempotent.
   */
  @Throttle({ default: { limit: 3, ttl: 3600_000 } }) // 3 lần / giờ — chống nhầm
  @ApiDoc({ summary: 'Request permanent data deletion (Meta App Review compliance)' })
  @Post('/data-deletion')
  async requestDataDeletion(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { confirmationCode } = await this.auth.requestDataDeletion(user.id)
    clearAuthCookies(res, this.cookieConfig())
    return {
      ok: true,
      confirmationCode,
      message: 'Yêu cầu xoá dữ liệu đã ghi nhận. Tài khoản sẽ bị xoá vĩnh viễn sau 30 ngày.',
      hardDeleteAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    }
  }

  private cookieConfig(): AuthCookieConfig {
    return {
      accessName: this.config.auth.accessCookieName,
      refreshName: this.config.auth.refreshCookieName,
      domain: this.config.app.cookieDomain,
      secure: this.config.app.cookieSecure,
      sameSite: 'lax',
      accessMaxAgeMs: 15 * 60 * 1000,
      refreshMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
      refreshPath: '/api/v1/auth/refresh',
    }
  }
}
