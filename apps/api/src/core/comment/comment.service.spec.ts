import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Comment } from '@prisma/client'
import { CommentService } from './comment.service'
import { COMMENT_NEW_EVENT } from './comment.events'
import type { IngestCommentInput } from './comment.repository'

function makeComment(overrides: Partial<Comment> = {}): Comment {
  const now = new Date()
  return {
    id: 'cmt_1',
    userId: 'user_1',
    accountId: 'acc_1',
    publishRecordId: null,
    platform: 'FACEBOOK',
    platformCommentId: 'fb_cmt_123',
    parentCommentId: null,
    authorId: 'author_1',
    authorName: 'John',
    authorAvatarUrl: null,
    text: 'hello',
    mediaUrl: null,
    likeCount: 0,
    replyCount: 0,
    status: 'NEW',
    repliedAt: null,
    replyText: null,
    replyPlatformId: null,
    replyByAutoReplyRuleId: null,
    platformCreatedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as Comment
}

function makeInput(overrides: Partial<IngestCommentInput> = {}): IngestCommentInput {
  return {
    userId: 'user_1',
    accountId: 'acc_1',
    platform: 'FACEBOOK',
    platformCommentId: 'fb_cmt_123',
    authorId: 'author_1',
    authorName: 'John',
    text: 'hello',
    platformCreatedAt: new Date(),
    ...overrides,
  }
}

describe('CommentService.ingestPlatformComment', () => {
  let service: CommentService
  let repo: { upsertByPlatformId: ReturnType<typeof vi.fn> }
  let events: { emit: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = { upsertByPlatformId: vi.fn() }
    events = { emit: vi.fn() }

    service = new CommentService(
      repo as never,
      {} as never, // accountService not used by ingestPlatformComment
      {} as never, // providers
      {} as never, // ctx
      events as never,
    )
  })

  it('emits comment.new with payload when insert is new', async () => {
    const comment = makeComment()
    repo.upsertByPlatformId.mockResolvedValue({ comment, isNew: true })

    const result = await service.ingestPlatformComment(makeInput())

    expect(result).toBe(comment)
    expect(events.emit).toHaveBeenCalledTimes(1)
    expect(events.emit).toHaveBeenCalledWith(COMMENT_NEW_EVENT, {
      commentId: comment.id,
      userId: comment.userId,
      accountId: comment.accountId,
      platform: comment.platform,
    })
  })

  it('does NOT emit when comment is duplicate (isNew=false)', async () => {
    const comment = makeComment()
    repo.upsertByPlatformId.mockResolvedValue({ comment, isNew: false })

    const result = await service.ingestPlatformComment(makeInput())

    expect(result).toBe(comment)
    expect(events.emit).not.toHaveBeenCalled()
  })

  it('passes input through to repo unchanged', async () => {
    const comment = makeComment()
    repo.upsertByPlatformId.mockResolvedValue({ comment, isNew: true })
    const input = makeInput({ platformCommentId: 'unique_id_xyz', text: 'how much?' })

    await service.ingestPlatformComment(input)

    expect(repo.upsertByPlatformId).toHaveBeenCalledWith(input)
  })
})

describe('CommentService.ingestBatch', () => {
  let service: CommentService
  let repo: { upsertByPlatformId: ReturnType<typeof vi.fn> }
  let events: { emit: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = { upsertByPlatformId: vi.fn() }
    events = { emit: vi.fn() }
    service = new CommentService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      events as never,
    )
  })

  it('counts inserted vs updated and emits only for new', async () => {
    repo.upsertByPlatformId
      .mockResolvedValueOnce({ comment: makeComment({ id: 'c1' }), isNew: true })
      .mockResolvedValueOnce({ comment: makeComment({ id: 'c2' }), isNew: false })
      .mockResolvedValueOnce({ comment: makeComment({ id: 'c3' }), isNew: true })

    const result = await service.ingestBatch('FACEBOOK', [
      makeInput({ platformCommentId: '1' }),
      makeInput({ platformCommentId: '2' }),
      makeInput({ platformCommentId: '3' }),
    ])

    expect(result).toEqual({ inserted: 2, updated: 1 })
    expect(events.emit).toHaveBeenCalledTimes(2)
  })

  it('handles empty batch', async () => {
    const result = await service.ingestBatch('INSTAGRAM', [])
    expect(result).toEqual({ inserted: 0, updated: 0 })
    expect(events.emit).not.toHaveBeenCalled()
  })
})
