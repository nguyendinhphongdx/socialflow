import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoReplyRule } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { AutoReplyRuleService, type MatchableComment } from './auto-reply-rule.service'
import { AutoReplyRuleRepository } from './auto-reply-rule.repository'

function makeRule(overrides: Partial<AutoReplyRule> = {}): AutoReplyRule {
  const now = new Date()
  return {
    id: 'rule_1',
    userId: 'user_1',
    name: 'Test rule',
    enabled: true,
    platforms: ['FACEBOOK'],
    accountIds: [],
    keywordsAny: ['price', 'cost'],
    keywordsAll: [],
    keywordsNone: [],
    replyTemplate: 'Hi {{authorName}}',
    replyDelaySec: 60,
    maxRepliesPerDay: 50,
    repliesToday: 0,
    lastResetAt: now,
    matchCount: 0,
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeComment(overrides: Partial<MatchableComment> = {}): MatchableComment {
  return {
    text: 'How much is the price?',
    platform: 'FACEBOOK',
    accountId: 'acc_1',
    ...overrides,
  }
}

describe('AutoReplyRuleService', () => {
  let service: AutoReplyRuleService
  let repo: {
    getByIdAndUserId: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    updateById: ReturnType<typeof vi.fn>
    softDeleteById: ReturnType<typeof vi.fn>
    listByUserWithPagination: ReturnType<typeof vi.fn>
  }
  let ctx: { requireUserId: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    repo = {
      getByIdAndUserId: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      softDeleteById: vi.fn(),
      listByUserWithPagination: vi.fn(),
    }
    ctx = { requireUserId: vi.fn().mockReturnValue('user_1') }
    const module = await Test.createTestingModule({
      providers: [
        AutoReplyRuleService,
        { provide: AutoReplyRuleRepository, useValue: repo },
        { provide: RequestContextService, useValue: ctx },
      ],
    }).compile()
    service = module.get(AutoReplyRuleService)
  })

  describe('getByCurrentUserAndId', () => {
    it('returns rule when exists for user', async () => {
      const rule = makeRule()
      repo.getByIdAndUserId.mockResolvedValue(rule)
      const result = await service.getByCurrentUserAndId('rule_1')
      expect(result.id).toBe('rule_1')
      expect(repo.getByIdAndUserId).toHaveBeenCalledWith('rule_1', 'user_1')
    })

    it('throws AutoReplyRuleNotFound when not exists', async () => {
      repo.getByIdAndUserId.mockResolvedValue(null)
      await expect(service.getByCurrentUserAndId('rule_x'))
        .rejects.toMatchObject({ code: ResponseCode.AutoReplyRuleNotFound })
    })
  })

  describe('toggleEnabled', () => {
    it('flips enabled flag', async () => {
      const rule = makeRule({ enabled: true })
      repo.getByIdAndUserId.mockResolvedValue(rule)
      repo.updateById.mockResolvedValue({ ...rule, enabled: false })
      const result = await service.toggleEnabled('rule_1')
      expect(repo.updateById).toHaveBeenCalledWith('rule_1', { enabled: false })
      expect(result.enabled).toBe(false)
    })
  })

  describe('matchRules', () => {
    it('matches when keywordsAny hits and platform/account ok', () => {
      const rule = makeRule({ keywordsAny: ['price'] })
      const matched = service.matchRules(makeComment(), [rule])
      expect(matched).toHaveLength(1)
    })

    it('does not match when no keywordsAny hits', () => {
      const rule = makeRule({ keywordsAny: ['shipping'] })
      const matched = service.matchRules(makeComment(), [rule])
      expect(matched).toHaveLength(0)
    })

    it('is case-insensitive', () => {
      const rule = makeRule({ keywordsAny: ['PRICE'] })
      const matched = service.matchRules(makeComment({ text: 'what is the price?' }), [rule])
      expect(matched).toHaveLength(1)
    })

    it('requires ALL keywordsAll to be present', () => {
      const rule = makeRule({
        keywordsAny: ['price'],
        keywordsAll: ['shipping', 'price'],
      })
      // Only contains 'price', missing 'shipping'
      const noMatch = service.matchRules(makeComment(), [rule])
      expect(noMatch).toHaveLength(0)

      const match = service.matchRules(
        makeComment({ text: 'price and shipping how much?' }),
        [rule],
      )
      expect(match).toHaveLength(1)
    })

    it('excludes when keywordsNone hits', () => {
      const rule = makeRule({
        keywordsAny: ['price'],
        keywordsNone: ['free'],
      })
      const matched = service.matchRules(
        makeComment({ text: 'is the price free?' }),
        [rule],
      )
      expect(matched).toHaveLength(0)
    })

    it('skips when platform does not match', () => {
      const rule = makeRule({ platforms: ['INSTAGRAM'] })
      const matched = service.matchRules(
        makeComment({ platform: 'FACEBOOK' }),
        [rule],
      )
      expect(matched).toHaveLength(0)
    })

    it('skips when accountIds limit set and account not in list', () => {
      const rule = makeRule({ accountIds: ['acc_99'] })
      const matched = service.matchRules(
        makeComment({ accountId: 'acc_1' }),
        [rule],
      )
      expect(matched).toHaveLength(0)
    })

    it('applies to all accounts when accountIds empty', () => {
      const rule = makeRule({ accountIds: [] })
      const matched = service.matchRules(
        makeComment({ accountId: 'acc_any' }),
        [rule],
      )
      expect(matched).toHaveLength(1)
    })

    it('skips disabled rules even if passed in', () => {
      const rule = makeRule({ enabled: false })
      const matched = service.matchRules(makeComment(), [rule])
      expect(matched).toHaveLength(0)
    })
  })
})
