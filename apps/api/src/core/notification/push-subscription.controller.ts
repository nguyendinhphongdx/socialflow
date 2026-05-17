import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  ApiDoc,
  AppException,
  CurrentUser,
  ResponseCode,
  type AuthUser,
} from '@sociflow/common'
import { PushSubscriptionRepository } from './push-subscription.repository'
import {
  SubscribePushDto,
  SubscribePushDtoSchema,
} from './push-subscription.dto'
import { PushSubscriptionListVo, PushSubscriptionVo } from './push-subscription.vo'

/**
 * Push subscription REST endpoints.
 *
 *  - POST /notifications/push/subscribe — FE gọi sau khi `pushManager.subscribe()`.
 *  - DELETE /notifications/push/:id — user gỡ device khỏi list push.
 *  - GET /notifications/push — list devices đã subscribe.
 *
 * Subscription endpoint unique → re-subscribe cùng device = upsert (giữ ID cũ).
 */
@ApiTags('Notification/Push')
@ApiBearerAuth()
@Controller('/notifications/push')
export class PushSubscriptionController {
  constructor(private readonly repo: PushSubscriptionRepository) {}

  @ApiDoc({
    summary: 'Đăng ký Web Push subscription (sau pushManager.subscribe)',
    body: SubscribePushDtoSchema,
    response: PushSubscriptionVo,
  })
  @Post('/subscribe')
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribePushDto,
  ): Promise<PushSubscriptionVo> {
    const entity = await this.repo.upsertByEndpoint({
      userId: user.id,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      deviceTag: dto.deviceTag ?? null,
    })
    return PushSubscriptionVo.create(entity)
  }

  @ApiDoc({ summary: 'List push devices của user hiện tại', response: PushSubscriptionListVo })
  @Get('/')
  async list(@CurrentUser() user: AuthUser): Promise<PushSubscriptionListVo> {
    const entities = await this.repo.listByUserId(user.id)
    return PushSubscriptionListVo.create(entities)
  }

  @ApiDoc({ summary: 'Xoá 1 push subscription (unsubscribe device)' })
  @Delete('/:id')
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const existing = await this.repo.getByIdAndUserId(id, user.id)
    if (!existing) {
      throw new AppException(ResponseCode.AccessDenied, { subscriptionId: id })
    }
    await this.repo.deleteById(id)
    return { ok: true }
  }
}
