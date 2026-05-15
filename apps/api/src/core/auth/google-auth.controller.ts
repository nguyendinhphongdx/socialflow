import { Controller, Get, Inject, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ApiDoc, AppException, Public, ResponseCode } from '@sociflow/common'
import { clearAuthCookies, setAuthCookies, type AuthCookieConfig } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { GoogleAuthService } from './google-auth.service'

@ApiTags('Auth')
@Controller('/auth/google')
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @ApiDoc({ summary: 'Redirect tới Google OAuth consent screen' })
  @Get('/')
  async start(@Query('returnUrl') returnUrl: string | undefined, @Res() res: Response) {
    const url = await this.google.buildAuthorizeUrl(returnUrl)
    return res.redirect(url)
  }

  @Public()
  @ApiDoc({ summary: 'Google OAuth callback — exchange code, issue session, redirect về web' })
  @Get('/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (error) {
      clearAuthCookies(res, this.cookieConfig())
      return res.redirect(`${this.config.web.appUrl}/login?error=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'missing_code_or_state' })
    }

    const result = await this.google.handleCallback(code, state)
    setAuthCookies(res, result.tokens, this.cookieConfig())

    const target = result.returnUrl ?? `${this.config.web.appUrl}/dashboard`
    return res.redirect(target)
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
