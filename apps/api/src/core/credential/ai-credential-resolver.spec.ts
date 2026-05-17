import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResponseCode } from '@sociflow/common'
import { encrypt } from '@sociflow/common/crypto'
import { AiCredentialResolver } from './ai-credential-resolver'

const TEST_KEY = Buffer.alloc(32, 9).toString('base64')

describe('AiCredentialResolver', () => {
  let resolver: AiCredentialResolver
  let mockRepo: {
    findActiveByScope: ReturnType<typeof vi.fn>
    findByScope: ReturnType<typeof vi.fn>
    incrementSpent: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockRepo = {
      findActiveByScope: vi.fn(),
      findByScope: vi.fn(),
      incrementSpent: vi.fn(),
    }
    resolver = new AiCredentialResolver(mockRepo as never, { encryption: { key: TEST_KEY } } as never)
  })

  describe('resolve — fallback chain', () => {
    it('returns WORKSPACE credential khi active workspace row tồn tại', async () => {
      const encryptedKey = encrypt('sk-test-1234', TEST_KEY)
      mockRepo.findActiveByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'aic1',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            provider: 'OPENAI',
            apiKey: encryptedKey,
            baseUrl: null,
            model: 'gpt-4o',
            isActive: true,
            monthlyBudgetUsd: null,
            monthSpentUsd: 0,
          }
        }
        return null
      })

      const result = await resolver.resolve('OPENAI', 'ws1')
      expect(result.source).toBe('WORKSPACE')
      expect(result.apiKey).toBe('sk-test-1234')
      expect(result.model).toBe('gpt-4o')
    })

    it('throws AiBudgetExceeded khi workspace spent >= budget', async () => {
      const encryptedKey = encrypt('sk-x', TEST_KEY)
      mockRepo.findActiveByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'aic1',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            provider: 'OPENAI',
            apiKey: encryptedKey,
            baseUrl: null,
            model: null,
            isActive: true,
            monthlyBudgetUsd: '10.0000',
            monthSpentUsd: '10.0001',
          }
        }
        return null
      })
      await expect(resolver.resolve('OPENAI', 'ws1'))
        .rejects.toMatchObject({ code: ResponseCode.AiBudgetExceeded })
    })

    it('falls back to ENV cho OPENAI khi không có WORKSPACE/SYSTEM', async () => {
      mockRepo.findActiveByScope.mockResolvedValue(null)
      const result = await resolver.resolve('OPENAI', 'ws1')
      expect(result.source).toBe('ENV')
      expect(result.apiKey).toBe('')
      expect(result.credentialId).toBeNull()
    })
  })

  describe('describe', () => {
    it('returns ENV cho provider khi không có row', async () => {
      mockRepo.findByScope.mockResolvedValue(null)
      const result = await resolver.describe('ANTHROPIC', 'ws1')
      expect(result.source).toBe('ENV')
    })

    it('returns WORKSPACE source khi workspace row tồn tại', async () => {
      mockRepo.findByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'aic',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            provider: 'OPENAI',
            apiKey: '...',
            baseUrl: null,
            model: 'gpt-4o-mini',
            isActive: true,
            monthlyBudgetUsd: '50.00',
            monthSpentUsd: '12.50',
            notes: 'team key',
            updatedAt: new Date(),
          }
        }
        return null
      })
      const result = await resolver.describe('OPENAI', 'ws1')
      expect(result.source).toBe('WORKSPACE')
      expect(result.monthlyBudgetUsd).toBe(50)
      expect(result.monthSpentUsd).toBe(12.5)
    })
  })

  describe('incrementSpent', () => {
    it('skip khi amountUsd <= 0', async () => {
      await resolver.incrementSpent('aic1', 0)
      expect(mockRepo.incrementSpent).not.toHaveBeenCalled()
    })

    it('calls repo.incrementSpent với positive amount', async () => {
      mockRepo.incrementSpent.mockResolvedValue({
        id: 'aic1', provider: 'OPENAI', monthlyBudgetUsd: null, monthSpentUsd: '0.5',
      })
      await resolver.incrementSpent('aic1', 0.5)
      expect(mockRepo.incrementSpent).toHaveBeenCalledWith('aic1', 0.5)
    })
  })
})
