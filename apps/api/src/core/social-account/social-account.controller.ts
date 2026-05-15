import { Controller, Delete, Get, Inject, Param, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ApiDoc, AppException, CurrentUser, type AuthUser, Public, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import {
  ListSocialAccountDto,
  ListSocialAccountDtoSchema,
  ConnectYouTubeDto,
  ConnectYouTubeDtoSchema,
} from './social-account.dto'
import { SocialAccountListVo, SocialAccountVo } from './social-account.vo'
import { SocialAccountService } from './social-account.service'
import { YouTubeConnectService } from './youtube-connect.service'
import { FacebookConnectService } from './facebook-connect.service'
import { InstagramConnectService } from './instagram-connect.service'

@ApiTags('SocialAccount')
@ApiBearerAuth()
@Controller('/social-accounts')
export class SocialAccountController {
  constructor(
    private readonly accountService: SocialAccountService,
    private readonly youtube: YouTubeConnectService,
    private readonly facebook: FacebookConnectService,
    private readonly instagram: InstagramConnectService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @ApiDoc({
    summary: 'Liệt kê tài khoản đã connect',
    query: ListSocialAccountDtoSchema,
    response: SocialAccountListVo,
  })
  @Get('/')
  async list(@Query() query: ListSocialAccountDto) {
    const result = await this.accountService.listByCurrentUser(query, {
      platform: query.platform,
      status: query.status,
    })
    return new SocialAccountListVo({
      list: result.list.map(SocialAccountVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết 1 tài khoản', response: SocialAccountVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const account = await this.accountService.getByCurrentUserAndId(id)
    return SocialAccountVo.create(account)
  }

  @ApiDoc({ summary: 'Xoá kết nối tài khoản (soft delete)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.accountService.softDelete(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Bắt đầu OAuth flow connect YouTube channel',
    query: ConnectYouTubeDtoSchema,
  })
  @Get('/youtube/authorize')
  async startYouTubeConnect(
    @CurrentUser() user: AuthUser,
    @Query() query: ConnectYouTubeDto,
    @Res() res: Response,
  ) {
    const url = await this.youtube.buildAuthorizeUrl(user.id, {
      returnUrl: query.returnUrl,
      groupId: query.groupId,
    })
    return res.redirect(url)
  }

  @Public()
  @ApiDoc({ summary: 'YouTube OAuth callback' })
  @Get('/youtube/callback')
  async youtubeCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.config.web.appUrl}/dashboard/accounts?error=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'missing_code_or_state' })
    }
    const result = await this.youtube.handleCallback(code, state)
    const target = result.returnUrl ?? `${this.config.web.appUrl}/dashboard/accounts?connected=${result.account.id}`
    return res.redirect(target)
  }

  @ApiDoc({
    summary: 'Bắt đầu OAuth flow connect Facebook (list pages user manage)',
    query: ConnectYouTubeDtoSchema,
  })
  @Get('/facebook/authorize')
  async startFacebookConnect(
    @CurrentUser() user: AuthUser,
    @Query() query: ConnectYouTubeDto,
    @Res() res: Response,
  ) {
    const url = await this.facebook.buildAuthorizeUrl(user.id, {
      returnUrl: query.returnUrl,
      groupId: query.groupId,
    })
    return res.redirect(url)
  }

  @Public()
  @ApiDoc({ summary: 'Facebook OAuth callback — connect tất cả page user manage' })
  @Get('/facebook/callback')
  async facebookCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.config.web.appUrl}/dashboard/accounts?error=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'missing_code_or_state' })
    }
    const result = await this.facebook.handleCallback(code, state)
    const target = result.returnUrl ?? `${this.config.web.appUrl}/dashboard/accounts?connected=${result.pageCount}_pages`
    return res.redirect(target)
  }

  @ApiDoc({
    summary: 'Bắt đầu OAuth flow connect Instagram Business (qua FB pages có IG linked)',
    query: ConnectYouTubeDtoSchema,
  })
  @Get('/instagram/authorize')
  async startInstagramConnect(
    @CurrentUser() user: AuthUser,
    @Query() query: ConnectYouTubeDto,
    @Res() res: Response,
  ) {
    const url = await this.instagram.buildAuthorizeUrl(user.id, {
      returnUrl: query.returnUrl,
      groupId: query.groupId,
    })
    return res.redirect(url)
  }

  @Public()
  @ApiDoc({ summary: 'Instagram OAuth callback' })
  @Get('/instagram/callback')
  async instagramCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.config.web.appUrl}/dashboard/accounts?error=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'missing_code_or_state' })
    }
    const result = await this.instagram.handleCallback(code, state)
    const target = result.returnUrl ?? `${this.config.web.appUrl}/dashboard/accounts?connected=${result.count}_ig`
    return res.redirect(target)
  }
}
