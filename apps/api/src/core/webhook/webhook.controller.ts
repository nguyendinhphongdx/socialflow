import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import Stripe from 'stripe'
import { AppException, Public, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import { CreditsService } from '../credits/credits.service'
import {
  FacebookWebhookPayloadSchema,
  InstagramWebhookPayloadSchema,
  TikTokWebhookPayloadSchema,
} from './dto'
import { WebhookService } from './webhook.service'

export type WebhookSource = 'facebook' | 'instagram' | 'tiktok' | 'stripe'

/**
 * Public webhook receiver. Mỗi platform có endpoint riêng + DTO type-safe.
 *
 * Signature verify ở controller (cần raw body) → service nhận payload đã
 * verify + parse qua zod.
 */
@ApiTags('Webhook')
@Controller('/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name)
  private readonly stripe: Stripe

  constructor(
    private readonly service: WebhookService,
    private readonly creditsService: CreditsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2026-04-22.dahlia' })
  }

  /**
   * Facebook webhook subscribe verification (Meta call lúc subscribe webhook).
   */
  @Public()
  @Get('/facebook')
  verifyFacebook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.service.verifyMetaSubscribe(mode, token, challenge)
  }

  /**
   * Instagram webhook subscribe verification (share token với FB app).
   */
  @Public()
  @Get('/instagram')
  verifyInstagram(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.service.verifyMetaSubscribe(mode, token, challenge)
  }

  /**
   * Facebook page event delivery. Verify HMAC-SHA256 với app secret + raw body.
   */
  @Public()
  @HttpCode(200)
  @Post('/facebook')
  async handleFacebook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    this.service.verifyMetaSignature(signature, rawBody)
    const payload = FacebookWebhookPayloadSchema.parse(body)
    await this.service.handleFacebook(payload)
    return { ok: true }
  }

  /**
   * Instagram event delivery — cùng cơ chế signature như FB.
   */
  @Public()
  @HttpCode(200)
  @Post('/instagram')
  async handleInstagram(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    this.service.verifyMetaSignature(signature, rawBody)
    const payload = InstagramWebhookPayloadSchema.parse(body)
    await this.service.handleInstagram(payload)
    return { ok: true }
  }

  /**
   * TikTok event delivery — content posting status update.
   * TT đã ký với app secret + timestamp; phase tiếp implement verify.
   */
  @Public()
  @HttpCode(200)
  @Post('/tiktok')
  async handleTikTok(@Body() body: unknown): Promise<{ ok: true }> {
    const payload = TikTokWebhookPayloadSchema.parse(body)
    await this.service.handleTikTok(payload)
    return { ok: true }
  }

  /**
   * Stripe event delivery.
   *
   * Verify signature qua `stripe.webhooks.constructEvent(rawBody, sig, secret)`.
   * Dispatch event qua CreditsService → enqueue BullMQ job → ack 200 ngay
   * (Stripe yêu cầu phản hồi <30s, không xử lý nặng inline).
   */
  @Public()
  @HttpCode(200)
  @Post('/stripe')
  async handleStripe(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new AppException(ResponseCode.StripeWebhookInvalid, { reason: 'missing_signature' })
    }
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    if (!rawBody) {
      throw new AppException(ResponseCode.InternalError, { reason: 'raw_body_not_available' })
    }

    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.stripe.webhookSecret,
      )
    } catch (err) {
      this.logger.warn(
        `Stripe signature verify failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      throw new AppException(ResponseCode.StripeWebhookInvalid, { reason: 'signature_mismatch' })
    }

    this.logger.log(`Stripe webhook received: ${event.type} id=${event.id}`)
    await this.creditsService.dispatchStripeEvent({
      id: event.id,
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    })
    return { received: true }
  }
}
