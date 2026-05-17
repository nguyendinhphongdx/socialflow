import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Job } from 'bullmq'
import { AppException, ResponseCode } from '@sociflow/common'
import { SocialAccountRepository } from './social-account.repository'
import { SocialAccountService } from './social-account.service'
import { YouTubeConnectService } from './youtube-connect.service'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

interface TokenRefreshJob {
  accountId: string
  platform: string
}

@Processor(QUEUE_NAMES.TOKEN_REFRESH)
export class TokenRefreshConsumer extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshConsumer.name)

  constructor(
    private readonly repo: SocialAccountRepository,
    private readonly accountService: SocialAccountService,
    private readonly youtube: YouTubeConnectService,
    private readonly events: EventEmitter2,
  ) {
    super()
  }

  async process(job: Job<TokenRefreshJob>): Promise<void> {
    const { accountId, platform } = job.data
    const account = await this.repo.getById(accountId)
    if (!account) {
      this.logger.warn(`Account ${accountId} không tồn tại — skip`)
      return
    }
    if (!account.refreshToken) {
      this.logger.warn(`Account ${accountId} không có refresh token — mark TOKEN_EXPIRED`)
      await this.accountService.markTokenExpired(account.id)
      return
    }

    const decryptedRefresh = this.accountService.decryptRefreshToken(account)
    if (!decryptedRefresh) {
      await this.accountService.markTokenExpired(account.id)
      return
    }

    try {
      switch (platform) {
        case 'YOUTUBE':
          await this.youtube.refreshAccessToken(account.id, account.refreshToken, decryptedRefresh, account.workspaceId)
          this.logger.log(`Refreshed token for YT account ${account.id}`)
          return
        default:
          this.logger.warn(`Platform ${platform} chưa support refresh — skip`)
      }
    }
    catch (err) {
      if (err instanceof AppException && err.code === ResponseCode.AccountTokenExpired) {
        await this.accountService.markTokenExpired(account.id)
        this.events.emit('credential.expiring', {
          userId: account.userId,
          accountId: account.id,
          platform: account.platform,
          accountDisplayName: account.displayName,
        })
        this.logger.warn(`Refresh failed for account ${account.id} — marked TOKEN_EXPIRED + alert sent`)
        return
      }
      throw err   // re-throw để BullMQ retry
    }
  }
}
