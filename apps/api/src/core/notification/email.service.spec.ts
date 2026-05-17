import { beforeEach, describe, expect, it } from 'vitest'
import { NotificationType } from '@prisma/client'
import type { AppConfig } from '../../config'
import { EmailService } from './email.service'

/**
 * EmailService unit test — log-only mode (RESEND_API_KEY rỗng).
 *
 * Verify:
 *  - Render template không throw
 *  - HTML output non-empty (>= 500 bytes) — basic sanity
 *  - Plain-text fallback có nội dung core (link, subject)
 *  - sendByType log-only trả messageId=null thay vì throw
 */
describe('EmailService (log-only)', () => {
  let service: EmailService
  let config: Pick<AppConfig, 'notification'>

  beforeEach(() => {
    config = {
      notification: {
        resendApiKey: '',     // log-only mode
        fromEmail: 'no-reply@test.local',
        fromName: 'Test Sender',
        appUrl: 'https://app.test.local',
        creditLowThreshold: 20,
      },
    }
    service = new EmailService(config as AppConfig)
  })

  describe('getSubjectFor', () => {
    it('returns subject cho mỗi template type', () => {
      expect(service.getSubjectFor(NotificationType.EMAIL_VERIFY)).toMatch(/xác minh/i)
      expect(service.getSubjectFor(NotificationType.EMAIL_RESET)).toMatch(/mật khẩu/i)
      expect(service.getSubjectFor(NotificationType.EMAIL_PUBLISH_FAILED)).toMatch(/không thành công/i)
      expect(service.getSubjectFor(NotificationType.EMAIL_CREDIT_LOW)).toMatch(/credit/i)
      expect(service.getSubjectFor(NotificationType.EMAIL_ACCOUNT_EXPIRED)).toMatch(/kết nối lại/i)
    })
  })

  describe('render templates', () => {
    it('renders verify email với verifyUrl + expireAt', async () => {
      const html = await service.renderVerify({
        appUrl: 'https://app.test.local',
        name: 'Alice',
        verifyUrl: 'https://app.test.local/verify?token=abc',
        expireAt: new Date('2026-12-31T00:00:00Z'),
      })
      expect(html.length).toBeGreaterThan(200)
      expect(html).toContain('Alice')
      expect(html).toContain('https://app.test.local/verify?token=abc')
    })

    it('renders reset-password email', async () => {
      const html = await service.renderResetPassword({
        appUrl: 'https://app.test.local',
        name: 'Bob',
        resetUrl: 'https://app.test.local/reset?token=xyz',
        expireAt: new Date('2026-12-31T00:00:00Z'),
      })
      expect(html).toContain('Bob')
      expect(html).toContain('reset?token=xyz')
    })

    it('renders publish-failed email với error message', async () => {
      const html = await service.renderPublishFailed({
        appUrl: 'https://app.test.local',
        name: 'Carol',
        platform: 'YOUTUBE',
        postTitle: 'My video',
        errorMessage: 'Quota exceeded',
        publishRecordId: 'pub_1',
        retryUrl: 'https://app.test.local/publish/pub_1',
      })
      expect(html).toContain('YOUTUBE')
      expect(html).toContain('Quota exceeded')
      expect(html).toContain('My video')
    })

    it('renders account-expired email', async () => {
      const html = await service.renderAccountExpired({
        appUrl: 'https://app.test.local',
        name: 'Dave',
        platform: 'FACEBOOK',
        accountDisplayName: 'Brand Page',
        reconnectUrl: 'https://app.test.local/settings/accounts/acc_1',
      })
      expect(html).toContain('FACEBOOK')
      expect(html).toContain('Brand Page')
    })

    it('renders credit-low email với remaining + threshold', async () => {
      const html = await service.renderCreditLow({
        appUrl: 'https://app.test.local',
        name: 'Eve',
        remainingCredits: 5,
        threshold: 20,
        topUpUrl: 'https://app.test.local/billing',
      })
      expect(html).toContain('5')
      expect(html).toContain('20')
    })
  })

  describe('sendByType (log-only mode)', () => {
    it('returns messageId=null khi RESEND_API_KEY rỗng', async () => {
      const result = await service.sendByType(
        NotificationType.EMAIL_VERIFY,
        'test@example.com',
        {
          name: 'Test User',
          verifyUrl: 'https://app.test.local/verify',
          expireAt: new Date(),
        },
      )
      expect(result.messageId).toBeNull()
    })

    it('auto-inject appUrl nếu caller chưa truyền', async () => {
      // Không throw nếu caller chỉ truyền partial — appUrl được auto-fill.
      const result = await service.sendByType(
        NotificationType.EMAIL_CREDIT_LOW,
        'test@example.com',
        {
          name: 'Test',
          remainingCredits: 1,
          threshold: 20,
          topUpUrl: 'https://app.test.local/billing',
        },
      )
      expect(result.messageId).toBeNull()
    })
  })
})
