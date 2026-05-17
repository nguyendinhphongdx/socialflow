import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrandMention, BrandMonitor } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { BrandMonitorService } from './brand-monitor.service'

function makeMonitor(overrides: Partial<BrandMonitor> = {}): BrandMonitor {
  const now = new Date()
  return {
    id: 'mon_1',
    userId: 'user_1',
    name: 'My brand',
    query: 'sociflow',
    platforms: ['FACEBOOK'],
    enabled: true,
    lastPolledAt: null,
    pollIntervalMin: 60,
    matchCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeMention(overrides: Partial<BrandMention> = {}): BrandMention {
  const now = new Date()
  return {
    id: 'men_1',
    userId: 'user_1',
    monitorId: 'mon_1',
    platform: 'FACEBOOK',
    platformPostId: 'fb_post_1',
    authorName: 'Foo',
    authorPlatformId: 'fb_u1',
    text: 'I love sociflow!',
    permalink: 'https://fb.com/post/1',
    postedAt: now,
    matchedKeywords: ['sociflow'],
    sentiment: null,
    sentimentScore: null,
    status: 'NEW',
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('BrandMonitorService — mention persist + sentiment', () => {
  let service: BrandMonitorService
  let repo: {
    getById: ReturnType<typeof vi.fn>
    getByIdAndUserId: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    updateById: ReturnType<typeof vi.fn>
    softDeleteById: ReturnType<typeof vi.fn>
    listByUserWithPagination: ReturnType<typeof vi.fn>
    listDuePollNow: ReturnType<typeof vi.fn>
    setLastPolled: ReturnType<typeof vi.fn>
    incrementMatchCount: ReturnType<typeof vi.fn>
  }
  let mentionRepo: {
    getById: ReturnType<typeof vi.fn>
    getByIdAndUserId: ReturnType<typeof vi.fn>
    upsertByPlatformPostId: ReturnType<typeof vi.fn>
    updateSentiment: ReturnType<typeof vi.fn>
    updateStatusById: ReturnType<typeof vi.fn>
    listByUserWithPagination: ReturnType<typeof vi.fn>
  }
  let ctx: { requireUserId: ReturnType<typeof vi.fn> }
  let events: { emit: ReturnType<typeof vi.fn> }
  let sentimentQueue: { add: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = {
      getById: vi.fn(),
      getByIdAndUserId: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      softDeleteById: vi.fn(),
      listByUserWithPagination: vi.fn(),
      listDuePollNow: vi.fn(),
      setLastPolled: vi.fn(),
      incrementMatchCount: vi.fn(),
    }
    mentionRepo = {
      getById: vi.fn(),
      getByIdAndUserId: vi.fn(),
      upsertByPlatformPostId: vi.fn(),
      updateSentiment: vi.fn(),
      updateStatusById: vi.fn(),
      listByUserWithPagination: vi.fn(),
    }
    ctx = { requireUserId: vi.fn().mockReturnValue('user_1') }
    events = { emit: vi.fn() }
    sentimentQueue = { add: vi.fn().mockResolvedValue(undefined) }
    service = new BrandMonitorService(
      repo as never,
      mentionRepo as never,
      ctx as never,
      events as never,
      sentimentQueue as never,
    )
  })

  describe('recordMention', () => {
    it('persist + enqueue sentiment khi insert mới', async () => {
      const monitor = makeMonitor()
      const mention = makeMention()
      repo.getById.mockResolvedValue(monitor)
      mentionRepo.upsertByPlatformPostId.mockResolvedValue({ mention, isNew: true })

      const result = await service.recordMention({
        monitorId: 'mon_1',
        platform: 'FACEBOOK',
        platformPostId: 'fb_post_1',
        text: 'I love sociflow!',
        matchedKeywords: ['sociflow'],
      })

      expect(result.id).toBe('men_1')
      expect(events.emit).toHaveBeenCalledWith(
        'brand.mention.detected',
        expect.objectContaining({ mentionId: 'men_1', monitorId: 'mon_1' }),
      )
      expect(sentimentQueue.add).toHaveBeenCalledWith(
        'classify-sentiment',
        expect.objectContaining({ mentionId: 'men_1', text: 'I love sociflow!' }),
        expect.objectContaining({ jobId: 'sentiment-men_1' }),
      )
    })

    it('idempotent: không enqueue sentiment khi mention đã tồn tại', async () => {
      const monitor = makeMonitor()
      const mention = makeMention()
      repo.getById.mockResolvedValue(monitor)
      mentionRepo.upsertByPlatformPostId.mockResolvedValue({ mention, isNew: false })

      await service.recordMention({
        monitorId: 'mon_1',
        platform: 'FACEBOOK',
        platformPostId: 'fb_post_1',
        text: 'I love sociflow!',
        matchedKeywords: ['sociflow'],
      })

      expect(events.emit).not.toHaveBeenCalled()
      expect(sentimentQueue.add).not.toHaveBeenCalled()
    })

    it('không enqueue khi mention đã có sentiment (race với consumer)', async () => {
      const monitor = makeMonitor()
      const mention = makeMention({ sentiment: 'POSITIVE', sentimentScore: 0.9 })
      repo.getById.mockResolvedValue(monitor)
      mentionRepo.upsertByPlatformPostId.mockResolvedValue({ mention, isNew: true })

      await service.recordMention({
        monitorId: 'mon_1',
        platform: 'FACEBOOK',
        platformPostId: 'fb_post_1',
        text: 'great',
        matchedKeywords: ['sociflow'],
      })

      expect(events.emit).toHaveBeenCalled()
      expect(sentimentQueue.add).not.toHaveBeenCalled()
    })

    it('throws BrandMonitorNotFound khi monitor không tồn tại', async () => {
      repo.getById.mockResolvedValue(null)
      await expect(
        service.recordMention({
          monitorId: 'mon_x',
          platform: 'FACEBOOK',
          text: 't',
          matchedKeywords: [],
        }),
      ).rejects.toMatchObject({ code: ResponseCode.BrandMonitorNotFound })
    })

    it('throws BrandMonitorNotFound khi monitor đã soft-delete', async () => {
      repo.getById.mockResolvedValue(makeMonitor({ deletedAt: new Date() }))
      await expect(
        service.recordMention({
          monitorId: 'mon_1',
          platform: 'FACEBOOK',
          text: 't',
          matchedKeywords: [],
        }),
      ).rejects.toMatchObject({ code: ResponseCode.BrandMonitorNotFound })
    })
  })

  describe('getMentionByCurrentUserAndId', () => {
    it('returns mention khi exist + owned', async () => {
      mentionRepo.getByIdAndUserId.mockResolvedValue(makeMention())
      const result = await service.getMentionByCurrentUserAndId('men_1')
      expect(result.id).toBe('men_1')
      expect(mentionRepo.getByIdAndUserId).toHaveBeenCalledWith('men_1', 'user_1')
    })

    it('throws BrandMentionNotFound khi không tồn tại', async () => {
      mentionRepo.getByIdAndUserId.mockResolvedValue(null)
      await expect(service.getMentionByCurrentUserAndId('men_x'))
        .rejects.toMatchObject({ code: ResponseCode.BrandMentionNotFound })
    })
  })

  describe('ackMention / archiveMention', () => {
    it('ack → status ACKED', async () => {
      mentionRepo.getByIdAndUserId.mockResolvedValue(makeMention())
      mentionRepo.updateStatusById.mockResolvedValue(makeMention({ status: 'ACKED' }))
      const result = await service.ackMention('men_1')
      expect(mentionRepo.updateStatusById).toHaveBeenCalledWith('men_1', 'ACKED')
      expect(result.status).toBe('ACKED')
    })

    it('archive → status ARCHIVED', async () => {
      mentionRepo.getByIdAndUserId.mockResolvedValue(makeMention())
      mentionRepo.updateStatusById.mockResolvedValue(makeMention({ status: 'ARCHIVED' }))
      const result = await service.archiveMention('men_1')
      expect(mentionRepo.updateStatusById).toHaveBeenCalledWith('men_1', 'ARCHIVED')
      expect(result.status).toBe('ARCHIVED')
    })
  })
})
