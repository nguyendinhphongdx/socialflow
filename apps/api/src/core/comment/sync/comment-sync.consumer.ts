import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import axios from 'axios'
import { RetryableError } from '@sociflow/common'
import type { AccountPlatform, SocialAccount } from '@prisma/client'
import { SocialAccountRepository } from '../../social-account/social-account.repository'
import { SocialAccountService } from '../../social-account/social-account.service'
import { CommentRepository, type IngestCommentInput } from '../comment.repository'
import { CommentService } from '../comment.service'
import { QUEUE_NAMES } from '../../../libs/queue/queue.module'
import {
  COMMENT_SYNC_WINDOW_DAYS,
  type CommentSyncJob,
} from './comment-sync.types'

const YT_THREADS_URL = 'https://www.googleapis.com/youtube/v3/commentThreads'
const TT_COMMENTS_URL = 'https://open.tiktokapis.com/v2/research/video/comment/list/'

/**
 * Consumer COMMENT_SYNC: 1 job/account. Fetch comments mới từ platform
 * và gọi CommentService.ingestPlatformComment (idempotent upsert + emit
 * `comment.new` cho insert mới).
 *
 * Platform support:
 *  - YOUTUBE: commentThreads.list?videoId={postId}
 *  - TIKTOK: research/video/comment/list (yêu cầu Research API scope)
 *  - FACEBOOK/INSTAGRAM: skip — webhook real-time đủ; nếu cần backfill
 *    có thể enqueue manual qua admin tool.
 */
@Processor(QUEUE_NAMES.COMMENT_SYNC, { concurrency: 2 })
export class CommentSyncConsumer extends WorkerHost {
  private readonly logger = new Logger(CommentSyncConsumer.name)

  constructor(
    private readonly accountRepo: SocialAccountRepository,
    private readonly accountService: SocialAccountService,
    private readonly commentRepo: CommentRepository,
    private readonly commentService: CommentService,
  ) {
    super()
  }

  async process(job: Job<CommentSyncJob>): Promise<void> {
    const { accountId, postLimit } = job.data
    const account = await this.accountRepo.getById(accountId)
    if (!account || account.status !== 'ACTIVE') {
      this.logger.warn(`Account ${accountId} not found or inactive — skip sync`)
      return
    }

    const since = new Date(Date.now() - COMMENT_SYNC_WINDOW_DAYS * 24 * 3600 * 1000)
    const posts = await this.commentRepo.listRecentPublishedPostsByAccount(
      accountId,
      since,
      postLimit ?? 50,
    )
    if (posts.length === 0) {
      this.logger.debug(`No recent posts for ${account.platform} account ${accountId}`)
      return
    }

    const accessToken = this.accountService.decryptAccessToken(account)

    for (const post of posts) {
      try {
        await this.syncPost(account, accessToken, post)
      }
      catch (err) {
        if (err instanceof RetryableError) throw err
        this.logger.error(
          `Sync comments failed for post ${post.platformPostId} (${account.platform})`,
          err as Error,
        )
        // Tiếp tục post khác — không fail nguyên job.
      }
    }
  }

  private async syncPost(
    account: SocialAccount,
    accessToken: string,
    post: { id: string, platformPostId: string },
  ): Promise<void> {
    if (account.platform === 'YOUTUBE') {
      await this.syncYouTubePost(account, accessToken, post)
      return
    }
    if (account.platform === 'TIKTOK') {
      await this.syncTikTokPost(account, accessToken, post)
      return
    }
    // FB/IG dùng webhook — skip ở consumer này.
  }

  private async syncYouTubePost(
    account: SocialAccount,
    accessToken: string,
    post: { id: string, platformPostId: string },
  ): Promise<void> {
    const response = await axios.get<{
      items?: Array<{
        snippet: {
          topLevelComment: {
            id: string
            snippet: {
              authorChannelId?: { value?: string }
              authorDisplayName: string
              authorProfileImageUrl?: string
              textOriginal: string
              likeCount?: number
              publishedAt: string
            }
          }
          totalReplyCount?: number
        }
      }>
    }>(YT_THREADS_URL, {
      params: {
        part: 'snippet',
        videoId: post.platformPostId,
        maxResults: 100,
        order: 'time',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
    }).catch(() => { throw new RetryableError('youtube_commentThreads_fetch_failed') })

    if (response.status >= 500) throw new RetryableError(`yt ${response.status}`)
    if (response.status >= 400) {
      this.logger.warn(`YT commentThreads ${response.status} for video ${post.platformPostId}`)
      return
    }

    const items = response.data.items ?? []
    const inputs: IngestCommentInput[] = items.map((item) => {
      const c = item.snippet.topLevelComment.snippet
      return {
        userId: account.userId,
        accountId: account.id,
        publishRecordId: post.id,
        platform: 'YOUTUBE' as AccountPlatform,
        platformCommentId: item.snippet.topLevelComment.id,
        authorId: c.authorChannelId?.value ?? c.authorDisplayName,
        authorName: c.authorDisplayName,
        authorAvatarUrl: c.authorProfileImageUrl ?? null,
        text: c.textOriginal,
        likeCount: c.likeCount ?? 0,
        replyCount: item.snippet.totalReplyCount ?? 0,
        platformCreatedAt: new Date(c.publishedAt),
      }
    })
    await this.commentService.ingestBatch('YOUTUBE', inputs)
  }

  private async syncTikTokPost(
    account: SocialAccount,
    accessToken: string,
    post: { id: string, platformPostId: string },
  ): Promise<void> {
    const response = await axios.post<{
      data?: { comments?: Array<{
        id: string
        text: string
        create_time: number
        like_count?: number
        reply_count?: number
        user?: { display_name?: string, avatar_url?: string, open_id?: string }
      }> }
    }>(TT_COMMENTS_URL, {
      video_id: post.platformPostId,
      max_count: 100,
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
    }).catch(() => { throw new RetryableError('tiktok_comments_fetch_failed') })

    if (response.status >= 500) throw new RetryableError(`tt ${response.status}`)
    if (response.status >= 400) {
      this.logger.warn(`TT comments ${response.status} for video ${post.platformPostId}`)
      return
    }

    const comments = response.data.data?.comments ?? []
    const inputs: IngestCommentInput[] = comments.map(c => ({
      userId: account.userId,
      accountId: account.id,
      publishRecordId: post.id,
      platform: 'TIKTOK' as AccountPlatform,
      platformCommentId: c.id,
      authorId: c.user?.open_id ?? c.user?.display_name ?? c.id,
      authorName: c.user?.display_name ?? 'TikTok user',
      authorAvatarUrl: c.user?.avatar_url ?? null,
      text: c.text,
      likeCount: c.like_count ?? 0,
      replyCount: c.reply_count ?? 0,
      platformCreatedAt: new Date(c.create_time * 1000),
    }))
    await this.commentService.ingestBatch('TIKTOK', inputs)
  }
}
