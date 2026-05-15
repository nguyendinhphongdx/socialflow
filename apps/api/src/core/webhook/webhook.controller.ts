import { createHmac } from 'node:crypto'
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { AppException, constantTimeEqual, Public, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import { WebhookService } from './webhook.service'

export type WebhookSource = 'facebook' | 'instagram' | 'tiktok'

/**
 * Public webhook receiver. Mỗi platform verify signature riêng.
 *
 * Phase 2 minimal: chỉ Facebook. IG + TT ở Phase tiếp.
 */
@ApiTags('Webhook')
@Controller('/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name)

  constructor(
    private readonly service: WebhookService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Facebook webhook verification (GET — Meta call lúc subscribe).
   */
  @Public()
  @Get('/facebook')
  verifyFacebook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? 'change-me'
    if (mode === 'subscribe' && constantTimeEqual(token, expected)) {
      return challenge
    }
    throw new AppException(ResponseCode.AccessDenied, { reason: 'fb_verify_token_mismatch' })
  }

  /**
   * Instagram webhook verification dùng chung token với FB app
   * (Meta Business app shared cho cả 2 product).
   */
  @Public()
  @Get('/instagram')
  verifyInstagram(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.verifyFacebook(mode, token, challenge)
  }

  /**
   * Facebook webhook event delivery (POST).
   * Verify HMAC-SHA256 với app secret + raw body.
   */
  @Public()
  @HttpCode(200)
  @Post('/facebook')
  async handleFacebook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    this.verifyFacebookSignature(req, signature)
    await this.service.handleFacebook(body)
    return { ok: true }
  }

  /**
   * Instagram webhook delivery (POST). Cùng cơ chế signature như FB
   * (Meta Graph dùng `x-hub-signature-256` + app secret).
   */
  @Public()
  @HttpCode(200)
  @Post('/instagram')
  async handleInstagram(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    this.verifyFacebookSignature(req, signature)
    // WebhookService.handleFacebook nhận `object` field từ payload (page|instagram)
    // → tự branch sang IG path.
    await this.service.handleFacebook(body)
    return { ok: true }
  }

  /**
   * Generic stub cho TT — implement sau khi có app credentials.
   */
  @Public()
  @HttpCode(200)
  @Post('/:source')
  async handleOther(@Param('source') source: string, @Body() body: unknown) {
    this.logger.log(`Webhook received from ${source}: ${JSON.stringify(body).slice(0, 200)}`)
    return { ok: true }
  }

  private verifyFacebookSignature(req: Request, signature: string | undefined): void {
    if (!signature) {
      throw new AppException(ResponseCode.AccessDenied, { reason: 'missing_signature' })
    }
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    if (!rawBody) {
      // CORS/raw body middleware chưa setup → reject để fail loud
      throw new AppException(ResponseCode.InternalError, { reason: 'raw_body_not_available' })
    }
    const expected = `sha256=${createHmac('sha256', this.config.oauth.facebook.clientSecret).update(rawBody).digest('hex')}`
    if (!constantTimeEqual(signature, expected)) {
      throw new AppException(ResponseCode.AccessDenied, { reason: 'invalid_signature' })
    }
  }
}
