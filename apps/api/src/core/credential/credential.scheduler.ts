import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AiCredentialRepository } from './ai-credential.repository'

/**
 * Reset monthly AI budget counters mỗi đầu tháng (UTC) — ADR-0010 budget tracking.
 *
 * Lưu ý: `monthlyBudgetUsd` không thay đổi; chỉ reset `monthSpentUsd = 0`.
 */
@Injectable()
export class CredentialScheduler {
  private readonly logger = new Logger(CredentialScheduler.name)

  constructor(private readonly aiRepo: AiCredentialRepository) {}

  /**
   * Cron: 00:05 UTC ngày 1 mỗi tháng. Buffer 5 phút sau midnight tránh
   * clock drift / DST issue.
   */
  @Cron('5 0 1 * *', { timeZone: 'UTC' })
  async resetMonthlyBudgets(): Promise<void> {
    const now = new Date()
    const count = await this.aiRepo.resetAllMonthlySpent(now)
    this.logger.log(`Monthly AI budget reset: ${count} credential rows`)
  }

  /**
   * Daily heartbeat — log warning nếu credential gần budget cap.
   * Để bật khi cần — currently no-op để tránh log noise.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'UTC' })
  async dailyBudgetCheck(): Promise<void> {
    // Placeholder — emit `ai-budget.warn` event khi spent > 80% budget.
    this.logger.debug('Daily AI budget check tick')
  }
}
