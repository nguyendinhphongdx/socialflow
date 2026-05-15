/**
 * Job payload + helper types cho COMMENT_SYNC queue.
 *
 * Scheduler (TT/YT) push 1 job per account per cycle. Consumer fetch
 * comments mới và gọi CommentService.ingestPlatformComment cho từng.
 *
 * `since` (ISO date) là watermark — fetch comments > since. Nếu null,
 * fetch các post PUBLISHED gần đây trong window mặc định (7 ngày).
 */
export interface CommentSyncJob {
  accountId: string
  /** ISO date string — fetch comments với platformCreatedAt > since */
  since?: string
  /** Số lượng PublishRecord scan (TT/YT) — default 50 */
  postLimit?: number
}

export const COMMENT_SYNC_JOB_NAME = 'sync'

export const COMMENT_SYNC_WINDOW_DAYS = 7
