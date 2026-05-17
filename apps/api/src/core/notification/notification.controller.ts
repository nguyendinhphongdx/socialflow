import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  ApiDoc,
  AppException,
  CurrentUser,
  ResponseCode,
  type AuthUser,
} from '@sociflow/common'
import { UserService } from '../user/user.service'
import { NotificationService } from './notification.service'
import { NotificationRepository } from './notification.repository'
import {
  ListNotificationDto,
  ListNotificationDtoSchema,
  SendTestEmailDto,
  SendTestEmailDtoSchema,
} from './notification.dto'
import {
  NotificationLogListVo,
  NotificationLogVo,
  SendTestEmailResultVo,
} from './notification.vo'

/**
 * Notification REST endpoints.
 *
 *  - GET /notifications — user xem lịch sử notification của chính mình.
 *  - POST /notifications/test-email — admin trigger gửi test email (verify Resend / template).
 *
 * Push & in-app: Phase 8+. Scope hiện tại chỉ EMAIL.
 */
@ApiTags('Notification')
@ApiBearerAuth()
@Controller('/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: NotificationRepository,
    private readonly userService: UserService,
  ) {}

  @ApiDoc({
    summary: 'Lịch sử notification của user hiện tại',
    query: ListNotificationDtoSchema,
    response: NotificationLogListVo,
  })
  @Get('/')
  async list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationDto) {
    const result = await this.notificationRepo.listByUserWithPagination(user.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
    return new NotificationLogListVo({
      list: result.list.map(NotificationLogVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Admin gửi test email cho 1 user',
    description: 'Chỉ ADMIN. Trigger thủ công để verify Resend + template render.',
    body: SendTestEmailDtoSchema,
    response: SendTestEmailResultVo,
  })
  @Post('/test-email')
  async sendTest(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendTestEmailDto,
  ): Promise<SendTestEmailResultVo> {
    if (user.role !== 'ADMIN') {
      throw new AppException(ResponseCode.AccessDenied, { reason: 'admin_only' })
    }

    const target = await this.userService.getById(dto.userId)
    const { logId } = await this.notificationService.sendEmail({
      userId: target.id,
      recipient: target.email,
      type: dto.type,
      templateData: dto.templateData,
    })
    return SendTestEmailResultVo.create(logId)
  }
}
