import { Inject, Injectable, Logger } from '@nestjs/common'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import * as React from 'react'
import { NotificationType } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import {
  AccountExpiredEmail,
  type AccountExpiredEmailProps,
  CreditLowEmail,
  type CreditLowEmailProps,
  PublishFailedEmail,
  type PublishFailedEmailProps,
  ResetPasswordEmail,
  type ResetPasswordEmailProps,
  VerifyEmail,
  type VerifyEmailProps,
} from '@sociflow/email'
import { APP_CONFIG, type AppConfig } from '../../config'

export interface SendEmailResult {
  /** Provider message ID (Resend) — null khi log-only mode (dev không có API key) */
  messageId: string | null
}

interface TemplateRegistration<P> {
  component: (props: P) => React.ReactElement
  subject: string
}

/**
 * EmailService — render template React Email → HTML → gửi qua Resend API.
 *
 * Dev mode (resendApiKey rỗng): chỉ render + log HTML preview, không gửi thật.
 * Prod mode: gọi Resend `emails.send`. Lỗi → throw để consumer retry với backoff.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly resend: Resend | null
  private readonly from: string

  private readonly templates: Record<NotificationType, TemplateRegistration<never>>

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.from = `${config.notification.fromName} <${config.notification.fromEmail}>`
    this.resend = config.notification.resendApiKey
      ? new Resend(config.notification.resendApiKey)
      : null

    // Casting qua `never` để bypass generic — runtime cast lại theo NotificationType.
    this.templates = {
      [NotificationType.EMAIL_VERIFY]: {
        component: VerifyEmail as unknown as (props: never) => React.ReactElement,
        subject: 'Xác minh email tài khoản Sociflow',
      },
      [NotificationType.EMAIL_RESET]: {
        component: ResetPasswordEmail as unknown as (props: never) => React.ReactElement,
        subject: 'Đặt lại mật khẩu Sociflow',
      },
      [NotificationType.EMAIL_PUBLISH_FAILED]: {
        component: PublishFailedEmail as unknown as (props: never) => React.ReactElement,
        subject: 'Bài đăng của bạn không thành công',
      },
      [NotificationType.EMAIL_ACCOUNT_EXPIRED]: {
        component: AccountExpiredEmail as unknown as (props: never) => React.ReactElement,
        subject: 'Tài khoản mạng xã hội cần kết nối lại',
      },
      [NotificationType.EMAIL_CREDIT_LOW]: {
        component: CreditLowEmail as unknown as (props: never) => React.ReactElement,
        subject: 'AI credit sắp hết',
      },
      [NotificationType.EMAIL_WELCOME]: {
        component: VerifyEmail as unknown as (props: never) => React.ReactElement,
        subject: 'Chào mừng bạn đến với Sociflow',
      },
    }
  }

  getSubjectFor(type: NotificationType): string {
    const tpl = this.templates[type]
    if (!tpl) throw new AppException(ResponseCode.NotificationTemplateMissing, { type })
    return tpl.subject
  }

  /**
   * Render + send.
   *  - logId: NotificationLog đã tạo trước (status QUEUED).
   *  - templateData: payload typed theo NotificationType (cast inside).
   *
   * Trả về { messageId } để consumer lưu vào metadata.
   * Throw nếu Resend fail — consumer wrap để mark FAILED + retry.
   */
  async sendByType(
    type: NotificationType,
    to: string,
    templateData: Record<string, unknown>,
  ): Promise<SendEmailResult> {
    const tpl = this.templates[type]
    if (!tpl) {
      throw new AppException(ResponseCode.NotificationTemplateMissing, { type })
    }

    const enriched = this.enrichWithAppUrl(templateData)
    const element = React.createElement(
      tpl.component as (props: Record<string, unknown>) => React.ReactElement,
      enriched,
    )
    const html = await render(element)
    const text = await render(element, { plainText: true })

    if (!this.resend) {
      this.logger.warn(
        `[dev/log-only] Skip Resend send. to=${to} type=${type} subject="${tpl.subject}" html_bytes=${html.length}`,
      )
      return { messageId: null }
    }

    const res = await this.resend.emails.send({
      from: this.from,
      to,
      subject: tpl.subject,
      html,
      text,
    })
    if (res.error) {
      this.logger.error(`Resend send failed: ${res.error.message}`)
      throw new AppException(ResponseCode.NotificationDeliveryFailed, {
        reason: res.error.message,
      })
    }

    return { messageId: res.data?.id ?? null }
  }

  /** Inject appUrl vào template props nếu caller chưa truyền. */
  private enrichWithAppUrl(data: Record<string, unknown>): Record<string, unknown> {
    if ('appUrl' in data && data.appUrl) return data
    return { ...data, appUrl: this.config.notification.appUrl }
  }

  /**
   * Helper typed cho test/unit — bypass queue, dùng trực tiếp.
   * Production code nên đi qua NotificationService.sendEmail (enqueue).
   */
  renderVerify(props: VerifyEmailProps): Promise<string> {
    return render(React.createElement(VerifyEmail, props))
  }

  renderResetPassword(props: ResetPasswordEmailProps): Promise<string> {
    return render(React.createElement(ResetPasswordEmail, props))
  }

  renderPublishFailed(props: PublishFailedEmailProps): Promise<string> {
    return render(React.createElement(PublishFailedEmail, props))
  }

  renderAccountExpired(props: AccountExpiredEmailProps): Promise<string> {
    return render(React.createElement(AccountExpiredEmail, props))
  }

  renderCreditLow(props: CreditLowEmailProps): Promise<string> {
    return render(React.createElement(CreditLowEmail, props))
  }
}
